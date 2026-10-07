//! LombokCache core (Rust reference, `no_std + alloc`, zero dependencies).
//!
//! Deterministic in-memory cache: TTL with an injectable clock, LRU eviction, tags, counters
//! and statistics. Behaviour is identical to the other ports for every vector in
//! `vectors/lombokcache-vectors-v1.json`; the normative contract is
//! `docs/SPEC_LombokCache_v0.1.0.md`.
#![cfg_attr(not(feature = "std"), no_std)]
#![forbid(unsafe_code)]

extern crate alloc;

pub mod json;

pub use json::{parse_json, Value};

use alloc::collections::BTreeMap;
use alloc::format;
use alloc::string::{String, ToString};
use alloc::vec::Vec;
use core::cell::Cell;

const MAX_SAFE: u64 = 9007199254740991;
/// Maximum key and tag length in UTF-8 bytes.
pub const MAX_KEY_BYTES: usize = 250;
const MAX_VALUE_DEPTH: usize = 512;

/// Error with a canonical `code` (contract) and an English message (not normative).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Error {
    pub code: &'static str,
    pub message: String,
}

impl Error {
    fn new(code: &'static str, message: &str) -> Self {
        Error {
            code,
            message: message.to_string(),
        }
    }
    /// Stable message id for translation through LombokLocale.
    pub fn message_id(&self) -> String {
        format!("lombokcache.error.{}", self.code)
    }
}

#[cfg(feature = "std")]
impl std::error::Error for Error {}

impl core::fmt::Display for Error {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

pub type Result<T> = core::result::Result<T, Error>;

/// Keys and tags: 1..=250 UTF-8 bytes, no control characters U+0000..U+001F and U+007F.
pub fn validate_key(key: &str) -> Result<()> {
    if key.is_empty() {
        return Err(Error::new("invalid_key", "key must be a non-empty string"));
    }
    if key.chars().any(|c| (c as u32) < 0x20 || c as u32 == 0x7f) {
        return Err(Error::new(
            "invalid_key",
            "key must not contain control characters",
        ));
    }
    if key.len() > MAX_KEY_BYTES {
        return Err(Error::new(
            "invalid_key",
            "key is longer than 250 UTF-8 bytes",
        ));
    }
    Ok(())
}

/// Namespaced key: parts escaped (`\` as `\\`, `:` as `\:`) and joined with `:`.
pub fn make_key(parts: &[&str]) -> Result<String> {
    if parts.is_empty() || parts.iter().any(|p| p.is_empty()) {
        return Err(Error::new(
            "invalid_key",
            "key parts must be non-empty strings",
        ));
    }
    let k = parts
        .iter()
        .map(|p| p.replace('\\', "\\\\").replace(':', "\\:"))
        .collect::<Vec<_>>()
        .join(":");
    validate_key(&k)?;
    Ok(k)
}

fn check_value(v: &Value, depth: usize) -> Result<()> {
    if depth > MAX_VALUE_DEPTH {
        return Err(Error::new("invalid_value", "value nested too deeply"));
    }
    match v {
        Value::Num(n) if !n.is_finite() => {
            Err(Error::new("invalid_value", "numbers must be finite"))
        }
        Value::Arr(a) => a.iter().try_for_each(|x| check_value(x, depth + 1)),
        Value::Obj(m) => m.iter().try_for_each(|(_, x)| check_value(x, depth + 1)),
        _ => Ok(()),
    }
}

fn safe_int(v: &Value) -> Option<i64> {
    match v {
        Value::Num(n)
            if (-(MAX_SAFE as f64)..=MAX_SAFE as f64).contains(n) && *n == (*n as i64) as f64 =>
        {
            Some(*n as i64)
        }
        _ => None,
    }
}

/// Time to live of a write.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Ttl {
    /// Use the cache's `default_ttl`.
    Default,
    /// Never expires.
    Never,
    /// Milliseconds, `1..=2^53-1`.
    Ms(u64),
}

/// Options of a write.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SetOptions {
    pub ttl: Ttl,
    pub tags: Vec<String>,
}

impl Default for SetOptions {
    fn default() -> Self {
        SetOptions {
            ttl: Ttl::Default,
            tags: Vec::new(),
        }
    }
}

fn check_ttl_ms(ms: u64) -> Result<u64> {
    if (1..=MAX_SAFE).contains(&ms) {
        Ok(ms)
    } else {
        Err(Error::new(
            "invalid_ttl",
            "ttl must be an integer number of milliseconds >= 1, or null",
        ))
    }
}

/// Construction options.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct CacheOptions {
    /// Maximum number of entries; `None` is unlimited.
    pub max_entries: Option<u64>,
    /// Default time to live in milliseconds; `None` means no expiry.
    pub default_ttl: Option<u64>,
}

/// Counters, in contract order.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct Stats {
    pub hits: u64,
    pub misses: u64,
    pub sets: u64,
    pub deletes: u64,
    pub evictions: u64,
    pub expirations: u64,
}

impl Stats {
    pub fn to_value(&self) -> Value {
        let mut o = Value::Obj(Vec::new());
        for (k, v) in [
            ("hits", self.hits),
            ("misses", self.misses),
            ("sets", self.sets),
            ("deletes", self.deletes),
            ("evictions", self.evictions),
            ("expirations", self.expirations),
        ] {
            o.set(k, Value::Num(v as f64));
        }
        o
    }
}

#[derive(Debug, Clone)]
struct Entry {
    value: Value,
    expires_at: Option<u64>,
    tags: Vec<String>,
    tick: u64,
}

/// In-memory cache with TTL, LRU eviction, tags and statistics. `C` returns the current time
/// in milliseconds.
pub struct Cache<C: Fn() -> u64> {
    map: BTreeMap<String, Entry>,
    order: BTreeMap<u64, String>,
    tick: u64,
    max_entries: Option<u64>,
    default_ttl: Option<u64>,
    clock: C,
    stats: Stats,
}

fn expiry(now: u64, ttl: Option<u64>) -> Option<u64> {
    ttl.map(|t| (now + t).min(MAX_SAFE))
}

fn live(e: &Entry, now: u64) -> bool {
    match e.expires_at {
        None => true,
        Some(x) => now < x,
    }
}

impl<C: Fn() -> u64> Cache<C> {
    pub fn new(options: CacheOptions, clock: C) -> Result<Self> {
        if let Some(m) = options.max_entries {
            if !(1..=MAX_SAFE).contains(&m) {
                return Err(Error::new(
                    "invalid_option",
                    "maxEntries must be an integer >= 1",
                ));
            }
        }
        if let Some(d) = options.default_ttl {
            if !(1..=MAX_SAFE).contains(&d) {
                return Err(Error::new(
                    "invalid_option",
                    "defaultTtl must be an integer >= 1 or null",
                ));
            }
        }
        Ok(Cache {
            map: BTreeMap::new(),
            order: BTreeMap::new(),
            tick: 0,
            max_entries: options.max_entries,
            default_ttl: options.default_ttl,
            clock,
            stats: Stats::default(),
        })
    }

    fn now(&self) -> Result<u64> {
        let t = (self.clock)();
        if t > MAX_SAFE {
            return Err(Error::new(
                "invalid_option",
                "clock must return a non-negative integer",
            ));
        }
        Ok(t)
    }

    fn remove(&mut self, key: &str) -> Option<Entry> {
        let e = self.map.remove(key)?;
        self.order.remove(&e.tick);
        Some(e)
    }

    /// True when a live entry exists; removes (and counts) an expired one.
    fn find(&mut self, key: &str, now: u64) -> bool {
        match self.map.get(key) {
            None => false,
            Some(e) if live(e, now) => true,
            Some(_) => {
                self.remove(key);
                self.stats.expirations += 1;
                false
            }
        }
    }

    fn touch_recency(&mut self, key: &str) {
        self.tick += 1;
        let t = self.tick;
        if let Some(e) = self.map.get_mut(key) {
            let old = e.tick;
            e.tick = t;
            self.order.remove(&old);
            self.order.insert(t, key.to_string());
        }
    }

    fn resolve_ttl(&self, ttl: Ttl) -> Result<Option<u64>> {
        match ttl {
            Ttl::Default => Ok(self.default_ttl),
            Ttl::Never => Ok(None),
            Ttl::Ms(ms) => check_ttl_ms(ms).map(Some),
        }
    }

    fn check_options(&self, o: &SetOptions) -> Result<Option<u64>> {
        let ttl = self.resolve_ttl(o.ttl)?;
        for t in &o.tags {
            validate_key(t)?;
        }
        Ok(ttl)
    }

    fn store(
        &mut self,
        key: &str,
        value: Value,
        expires_at: Option<u64>,
        tags: Vec<String>,
        now: u64,
    ) {
        if let Some(max) = self.max_entries {
            if !self.map.contains_key(key) && self.map.len() as u64 >= max {
                let expired: Vec<String> = self
                    .map
                    .iter()
                    .filter(|(_, e)| !live(e, now))
                    .map(|(k, _)| k.clone())
                    .collect();
                for k in expired {
                    self.remove(&k);
                    self.stats.expirations += 1;
                }
                while self.map.len() as u64 >= max {
                    let oldest = match self.order.iter().next() {
                        Some((_, k)) => k.clone(),
                        None => break,
                    };
                    self.remove(&oldest);
                    self.stats.evictions += 1;
                }
            }
        }
        self.remove(key);
        self.tick += 1;
        self.order.insert(self.tick, key.to_string());
        self.map.insert(
            key.to_string(),
            Entry {
                value,
                expires_at,
                tags,
                tick: self.tick,
            },
        );
        self.stats.sets += 1;
    }

    /// Store a value.
    pub fn set(&mut self, key: &str, value: &Value, options: &SetOptions) -> Result<()> {
        validate_key(key)?;
        let ttl = self.check_options(options)?;
        check_value(value, 0)?;
        let now = self.now()?;
        self.store(
            key,
            value.clone(),
            expiry(now, ttl),
            options.tags.clone(),
            now,
        );
        Ok(())
    }

    /// Store only when the key is absent or expired.
    pub fn add(&mut self, key: &str, value: &Value, options: &SetOptions) -> Result<bool> {
        validate_key(key)?;
        let ttl = self.check_options(options)?;
        check_value(value, 0)?;
        let now = self.now()?;
        if self.find(key, now) {
            return Ok(false);
        }
        self.store(
            key,
            value.clone(),
            expiry(now, ttl),
            options.tags.clone(),
            now,
        );
        Ok(true)
    }

    /// Value or `None` on a miss. Counts a hit or miss and refreshes recency.
    pub fn get(&mut self, key: &str) -> Result<Option<Value>> {
        validate_key(key)?;
        let now = self.now()?;
        if !self.find(key, now) {
            self.stats.misses += 1;
            return Ok(None);
        }
        self.stats.hits += 1;
        self.touch_recency(key);
        Ok(self.map.get(key).map(|e| e.value.clone()))
    }

    /// Value without touching recency or statistics.
    pub fn peek(&self, key: &str) -> Result<Option<Value>> {
        validate_key(key)?;
        let now = self.now()?;
        Ok(self
            .map
            .get(key)
            .filter(|e| live(e, now))
            .map(|e| e.value.clone()))
    }

    /// True for a live entry. Does not touch recency or statistics.
    pub fn has(&mut self, key: &str) -> Result<bool> {
        validate_key(key)?;
        let now = self.now()?;
        Ok(self.find(key, now))
    }

    /// Remove a live entry; true when one was removed.
    pub fn delete(&mut self, key: &str) -> Result<bool> {
        validate_key(key)?;
        let now = self.now()?;
        if !self.find(key, now) {
            return Ok(false);
        }
        self.remove(key);
        self.stats.deletes += 1;
        Ok(true)
    }

    /// Get and remove.
    pub fn pull(&mut self, key: &str) -> Result<Option<Value>> {
        let v = self.get(key)?;
        if self.remove(key).is_some() {
            self.stats.deletes += 1;
        }
        Ok(v)
    }

    /// Cached value, or the factory result which is then stored.
    /// A factory error is returned unchanged and nothing is stored.
    pub fn remember<F: FnOnce() -> Result<Value>>(
        &mut self,
        key: &str,
        factory: F,
        options: &SetOptions,
    ) -> Result<Value> {
        validate_key(key)?;
        let ttl = self.check_options(options)?;
        let now = self.now()?;
        if self.find(key, now) {
            self.stats.hits += 1;
            self.touch_recency(key);
            return Ok(self
                .map
                .get(key)
                .map(|e| e.value.clone())
                .unwrap_or(Value::Null));
        }
        let v = factory()?;
        check_value(&v, 0)?;
        self.stats.misses += 1;
        self.store(key, v.clone(), expiry(now, ttl), options.tags.clone(), now);
        Ok(v)
    }

    /// Add `by` to an integer entry. A missing key starts at 0 and is stored with the options'
    /// ttl and tags; an existing key keeps its expiry and tags.
    pub fn increment(&mut self, key: &str, by: i64, options: &SetOptions) -> Result<i64> {
        validate_key(key)?;
        if by.unsigned_abs() > MAX_SAFE {
            return Err(Error::new(
                "invalid_value",
                "increment must be a safe integer",
            ));
        }
        let ttl = self.check_options(options)?;
        let now = self.now()?;
        if !self.find(key, now) {
            self.store(
                key,
                Value::Num(by as f64),
                expiry(now, ttl),
                options.tags.clone(),
                now,
            );
            return Ok(by);
        }
        let cur = self
            .map
            .get(key)
            .and_then(|e| safe_int(&e.value))
            .ok_or_else(|| Error::new("invalid_value", "stored value is not an integer"))?;
        let next = cur + by;
        if next.unsigned_abs() > MAX_SAFE {
            return Err(Error::new("invalid_value", "result is not a safe integer"));
        }
        if let Some(e) = self.map.get_mut(key) {
            e.value = Value::Num(next as f64);
        }
        self.touch_recency(key);
        self.stats.sets += 1;
        Ok(next)
    }

    /// Subtract `by`.
    pub fn decrement(&mut self, key: &str, by: i64, options: &SetOptions) -> Result<i64> {
        validate_key(key)?;
        if by.unsigned_abs() > MAX_SAFE {
            return Err(Error::new(
                "invalid_value",
                "decrement must be a safe integer",
            ));
        }
        self.increment(key, -by, options)
    }

    /// Reset the expiry of a live entry.
    pub fn touch(&mut self, key: &str, ttl: Ttl) -> Result<bool> {
        validate_key(key)?;
        let t = self.resolve_ttl(ttl)?;
        let now = self.now()?;
        if !self.find(key, now) {
            return Ok(false);
        }
        if let Some(e) = self.map.get_mut(key) {
            e.expires_at = expiry(now, t);
        }
        self.touch_recency(key);
        Ok(true)
    }

    /// Remaining milliseconds; -1 when the entry never expires; -2 when there is no live entry.
    pub fn ttl(&mut self, key: &str) -> Result<i64> {
        validate_key(key)?;
        let now = self.now()?;
        if !self.find(key, now) {
            return Ok(-2);
        }
        Ok(match self.map.get(key).and_then(|e| e.expires_at) {
            None => -1,
            Some(x) => (x - now) as i64,
        })
    }

    /// Remove every live entry carrying `tag`; returns how many were removed.
    pub fn invalidate_tag(&mut self, tag: &str) -> Result<u64> {
        validate_key(tag)?;
        let now = self.now()?;
        let hit: Vec<(String, bool)> = self
            .map
            .iter()
            .filter(|(_, e)| e.tags.iter().any(|t| t == tag))
            .map(|(k, e)| (k.clone(), live(e, now)))
            .collect();
        let mut n = 0;
        for (k, is_live) in hit {
            self.remove(&k);
            if is_live {
                n += 1;
                self.stats.deletes += 1;
            } else {
                self.stats.expirations += 1;
            }
        }
        Ok(n)
    }

    /// Remove expired entries; returns how many.
    pub fn prune(&mut self) -> Result<u64> {
        let now = self.now()?;
        let expired: Vec<String> = self
            .map
            .iter()
            .filter(|(_, e)| !live(e, now))
            .map(|(k, _)| k.clone())
            .collect();
        for k in &expired {
            self.remove(k);
            self.stats.expirations += 1;
        }
        Ok(expired.len() as u64)
    }

    /// Number of live entries (prunes first).
    pub fn size(&mut self) -> Result<u64> {
        self.prune()?;
        Ok(self.map.len() as u64)
    }

    /// Live keys from least to most recently used (prunes first).
    pub fn keys(&mut self) -> Result<Vec<String>> {
        self.prune()?;
        Ok(self.order.values().cloned().collect())
    }

    /// Remove everything; returns the number of live entries removed.
    pub fn clear(&mut self) -> Result<u64> {
        let n = self.size()?;
        self.map.clear();
        self.order.clear();
        self.stats.deletes += n;
        Ok(n)
    }

    pub fn stats(&self) -> Stats {
        self.stats
    }
}

// ---------------------------------------------------------------- contract entry points

/// Operation names accepted by [`run`].
pub const OPS: [&str; 18] = [
    "set",
    "add",
    "get",
    "peek",
    "has",
    "delete",
    "pull",
    "remember",
    "increment",
    "decrement",
    "touch",
    "ttl",
    "invalidateTag",
    "prune",
    "size",
    "keys",
    "clear",
    "stats",
];

fn opt_err(m: &str) -> Error {
    Error::new("invalid_option", m)
}

fn int_option(v: &Value, m: &str) -> Result<u64> {
    match safe_int(v) {
        Some(n) if n >= 1 => Ok(n as u64),
        _ => Err(opt_err(m)),
    }
}

fn parse_cache_options(v: &Value) -> Result<CacheOptions> {
    let m = v
        .as_obj()
        .ok_or_else(|| opt_err("options must be an object"))?;
    let mut o = CacheOptions::default();
    for (k, x) in m {
        match k.as_str() {
            "maxEntries" => {
                o.max_entries = Some(int_option(x, "maxEntries must be an integer >= 1")?)
            }
            "defaultTtl" => {
                if *x != Value::Null {
                    o.default_ttl =
                        Some(int_option(x, "defaultTtl must be an integer >= 1 or null")?);
                }
            }
            "clock" => return Err(opt_err("run supplies its own clock")),
            _ => return Err(opt_err("unknown option")),
        }
    }
    Ok(o)
}

fn key_of(v: Option<&Value>) -> Result<&str> {
    match v {
        Some(Value::Str(s)) => Ok(s),
        _ => Err(Error::new("invalid_key", "key must be a non-empty string")),
    }
}

fn ttl_of(v: &Value) -> Result<Ttl> {
    match v {
        Value::Null => Ok(Ttl::Never),
        other => match safe_int(other) {
            Some(n) if n >= 1 => Ok(Ttl::Ms(n as u64)),
            _ => Err(Error::new(
                "invalid_ttl",
                "ttl must be an integer number of milliseconds >= 1, or null",
            )),
        },
    }
}

fn set_options_of(v: Option<&Value>) -> Result<SetOptions> {
    let mut o = SetOptions::default();
    let v = match v {
        None => return Ok(o),
        Some(v) => v,
    };
    let m = v
        .as_obj()
        .ok_or_else(|| opt_err("options must be an object"))?;
    for (k, _) in m {
        if k != "ttl" && k != "tags" {
            return Err(opt_err("unknown option"));
        }
    }
    if let Some(t) = v.get("ttl") {
        o.ttl = ttl_of(t)?;
    }
    if let Some(t) = v.get("tags") {
        let a = t
            .as_arr()
            .ok_or_else(|| opt_err("tags must be an array of strings"))?;
        for x in a {
            let s = key_of(Some(x))?;
            validate_key(s)?;
            o.tags.push(s.to_string());
        }
    }
    Ok(o)
}

fn by_of(v: Option<&Value>) -> Result<i64> {
    match v {
        None => Ok(1),
        Some(x) => safe_int(x)
            .ok_or_else(|| Error::new("invalid_value", "increment must be a safe integer")),
    }
}

fn step<C: Fn() -> u64>(cache: &mut Cache<C>, op: &str, s: &Value) -> Result<Value> {
    let key = || key_of(s.get("key"));
    let fallback = || s.get("fallback").cloned().unwrap_or(Value::Null);
    let num = |n: u64| Value::Num(n as f64);
    Ok(match op {
        "set" => {
            let k = key()?;
            validate_key(k)?;
            let o = set_options_of(s.get("options"))?;
            let v = s
                .get("value")
                .ok_or_else(|| Error::new("invalid_value", "value must be JSON data"))?;
            cache.set(k, v, &o)?;
            Value::Bool(true)
        }
        "add" => {
            let k = key()?;
            validate_key(k)?;
            let o = set_options_of(s.get("options"))?;
            let v = s
                .get("value")
                .ok_or_else(|| Error::new("invalid_value", "value must be JSON data"))?;
            Value::Bool(cache.add(k, v, &o)?)
        }
        "get" => cache.get(key()?)?.unwrap_or_else(fallback),
        "peek" => cache.peek(key()?)?.unwrap_or(Value::Null),
        "has" => Value::Bool(cache.has(key()?)?),
        "delete" => Value::Bool(cache.delete(key()?)?),
        "pull" => cache.pull(key()?)?.unwrap_or_else(fallback),
        "remember" => {
            let k = key()?;
            validate_key(k)?;
            let o = set_options_of(s.get("options"))?;
            let v = s.get("value").cloned();
            cache.remember(
                k,
                || v.ok_or_else(|| Error::new("invalid_value", "value must be JSON data")),
                &o,
            )?
        }
        "increment" | "decrement" => {
            let k = key()?;
            validate_key(k)?;
            let by = by_of(s.get("by"))?;
            let o = set_options_of(s.get("options"))?;
            let r = if op == "increment" {
                cache.increment(k, by, &o)?
            } else {
                cache.decrement(k, by, &o)?
            };
            Value::Num(r as f64)
        }
        "touch" => {
            let k = key()?;
            validate_key(k)?;
            let t = match s.get("ttl") {
                None => Ttl::Default,
                Some(v) => ttl_of(v)?,
            };
            Value::Bool(cache.touch(k, t)?)
        }
        "ttl" => Value::Num(cache.ttl(key()?)? as f64),
        "invalidateTag" => num(cache.invalidate_tag(key_of(s.get("tag"))?)?),
        "prune" => num(cache.prune()?),
        "size" => num(cache.size()?),
        "keys" => Value::Arr(cache.keys()?.into_iter().map(Value::Str).collect()),
        "clear" => num(cache.clear()?),
        _ => cache.stats().to_value(),
    })
}

/// Run a script of operations against a fresh cache whose clock is set by each step's `at`
/// (initially 0). Returns one output per step; a failing step yields `{"$error": code}` and
/// leaves the cache unchanged. This is the contract entry point used by the vectors.
pub fn run(options: &Value, steps: &Value) -> Result<Value> {
    let o = parse_cache_options(options)?;
    let steps = steps
        .as_arr()
        .ok_or_else(|| opt_err("steps must be an array"))?;
    let now = Cell::new(0u64);
    let mut cache = Cache::new(o, || now.get())?;
    let mut out = Vec::new();
    for s in steps {
        let op = match s.get("op") {
            Some(Value::Str(op)) if s.as_obj().is_some() && OPS.contains(&op.as_str()) => {
                op.as_str()
            }
            _ => return Err(opt_err("each step needs a known op")),
        };
        if let Some(at) = s.get("at") {
            match safe_int(at) {
                Some(t) if t >= 0 => now.set(t as u64),
                _ => return Err(opt_err("at must be a non-negative integer")),
            }
        }
        match step(&mut cache, op, s) {
            Ok(v) => out.push(v),
            Err(e) => {
                let mut o = Value::Obj(Vec::new());
                o.set("$error", Value::Str(e.code.to_string()));
                out.push(o);
            }
        }
    }
    Ok(Value::Arr(out))
}

/// Dynamic entry point with the contract's JSON calling convention (`fn`, `args`).
pub fn call(func: &str, args: &[Value]) -> Result<Value> {
    let null = Value::Null;
    let arg = |i: usize| args.get(i).unwrap_or(&null);
    match func {
        "run" => run(arg(0), arg(1)),
        "makeKey" => {
            let mut parts = Vec::new();
            for a in args {
                match a {
                    Value::Str(s) => parts.push(s.as_str()),
                    _ => {
                        return Err(Error::new(
                            "invalid_key",
                            "key parts must be non-empty strings",
                        ))
                    }
                }
            }
            make_key(&parts).map(Value::Str)
        }
        "validateKey" => match arg(0) {
            Value::Str(s) => validate_key(s).map(|_| Value::Str(s.clone())),
            _ => Err(Error::new("invalid_key", "key must be a non-empty string")),
        },
        _ => Err(opt_err("unknown function")),
    }
}
