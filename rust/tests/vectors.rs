//! Executes every case of vectors/lombokcache-vectors-v1.json (GP-11).
use lombokcache::{call, parse_json, Value};

fn vector_text() -> String {
    let p = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../vectors/lombokcache-vectors-v1.json"
    );
    std::fs::read_to_string(p).expect("vectors file")
}

fn s(v: &Value) -> &str {
    v.as_str().expect("expected string")
}

#[test]
fn all_vectors_match() {
    let doc = parse_json(&vector_text()).expect("vectors parse");
    let groups = doc.get("groups").and_then(|g| g.as_arr()).expect("groups");
    let mut total = 0usize;
    let mut failures: Vec<String> = Vec::new();
    for g in groups {
        for k in g.get("cases").and_then(|c| c.as_arr()).expect("cases") {
            total += 1;
            let name = s(k.get("name").unwrap());
            let func = s(k.get("fn").unwrap());
            let args = k.get("args").and_then(|a| a.as_arr()).expect("args");
            let expect = k.get("expect").unwrap();
            let got = call(func, args);
            match (expect.get("error"), got) {
                (Some(code), Err(e)) => {
                    if e.code != s(code) {
                        failures.push(format!("{}: error {} != {}", name, e.code, s(code)));
                    }
                }
                (Some(code), Ok(r)) => failures.push(format!(
                    "{}: expected error {} but got {}",
                    name,
                    s(code),
                    r.to_json()
                )),
                (None, Err(e)) => failures.push(format!("{}: unexpected error {}", name, e)),
                (None, Ok(r)) => {
                    let want = expect.get("result").unwrap().to_json();
                    if r.to_json() != want {
                        failures.push(format!(
                            "{}:\n  got      {}\n  expected {}",
                            name,
                            r.to_json(),
                            want
                        ));
                    }
                }
            }
        }
    }
    assert!(total >= 100, "GP-11 needs >= 100 cases, ran {}", total);
    assert!(
        failures.is_empty(),
        "{} of {} failed:\n{}",
        failures.len(),
        total,
        failures.join("\n")
    );
    println!("vectors executed: {}", total);
}

#[test]
fn malformed_json_is_rejected_without_panic() {
    for bad in [
        "",
        "{",
        "[1,]",
        "{\"a\":}",
        "\"\\ud800\"",
        "01",
        "1.",
        "nul",
        "{} x",
    ] {
        assert!(parse_json(bad).is_err(), "input {:?}", bad);
    }
    let deep = format!("{}1{}", "[".repeat(5000), "]".repeat(5000));
    assert!(parse_json(&deep).is_err());
}

#[test]
fn js_number_formatting() {
    for (n, t) in [
        (1.0, "1"),
        (0.5, "0.5"),
        (-3.0, "-3"),
        (1e21, "1e+21"),
        (1e20, "100000000000000000000"),
        (1e-7, "1e-7"),
        (0.000001, "0.000001"),
        (123456789012.0, "123456789012"),
        (-0.0, "0"),
        (1.5e300, "1.5e+300"),
        (5e-324, "5e-324"),
        (0.1 + 0.2, "0.30000000000000004"),
    ] {
        assert_eq!(Value::Num(n).to_json(), t);
    }
}

#[test]
fn readme_rust_example() {
    use core::cell::Cell;
    use lombokcache::{Cache, CacheOptions, SetOptions, Ttl};
    let now = Cell::new(0u64);
    let mut cache = Cache::new(
        CacheOptions {
            max_entries: Some(2),
            default_ttl: None,
        },
        || now.get(),
    )
    .unwrap();
    cache
        .set(
            "a",
            &Value::Num(1.0),
            &SetOptions {
                ttl: Ttl::Ms(100),
                tags: vec![],
            },
        )
        .unwrap();
    now.set(100);
    assert_eq!(cache.get("a").unwrap(), None);
}
