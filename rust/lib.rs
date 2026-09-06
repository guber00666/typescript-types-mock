#![deny(clippy::all)]

// typescript-types-mock — Rust native core
// High-performance TypeScript type mocking via napi-rs (Node) or wasm-bindgen (Browser)

mod types;
mod random;
mod parser;
mod resolver;
mod generator;
mod context;

#[cfg(test)]
mod parser_integration_test;

#[cfg(feature = "node")]
use napi_derive::napi;

pub use types::*;
pub use random::RandomGenerator;
#[cfg(not(target_arch = "wasm32"))]
pub use parser::parse_file;
pub use parser::{parse_source, Declaration};
pub use resolver::TypeResolver;
pub use generator::MockGenerator;
pub use context::MockContext;

use serde_json::Value;
use types::options::MockOptions;

// ─── Node.js napi exports ──────────────────────────────────────

#[cfg(feature = "node")]
/// Parse a .ts file and generate a mock for the given type.
#[napi]
pub fn create_mock_from_file(
    file_path: String,
    type_name: String,
    options: Option<MockOptions>,
) -> napi::Result<Value> {
    let ctx = MockContext::new(&file_path, MockOptions::default())
        .map_err(napi::Error::from_reason)?;
    ctx.mock(&type_name, options)
        .map_err(napi::Error::from_reason)
}

#[cfg(feature = "node")]
/// Parse a .ts file and generate multiple mocks.
#[napi]
pub fn create_many_mocks(
    file_path: String,
    type_name: String,
    count: u32,
    options: Option<MockOptions>,
) -> napi::Result<Vec<Value>> {
    let ctx = MockContext::new(&file_path, MockOptions::default())
        .map_err(napi::Error::from_reason)?;
    ctx.many(&type_name, count, options)
        .map_err(napi::Error::from_reason)
}

#[cfg(feature = "node")]
/// List all type names in a .ts file.
#[napi]
pub fn list_types(file_path: String) -> napi::Result<Vec<String>> {
    let ctx = MockContext::new(&file_path, MockOptions::default())
        .map_err(napi::Error::from_reason)?;
    Ok(ctx.list_types())
}

#[cfg(feature = "node")]
/// Parse TypeScript source code and generate a mock (no file needed).
#[napi]
pub fn mock_from_source(
    source: String,
    type_name: String,
    options: Option<MockOptions>,
) -> napi::Result<Value> {
    let ctx = MockContext::from_source(&source, "input.ts", MockOptions::default())
        .map_err(napi::Error::from_reason)?;
    ctx.mock(&type_name, options)
        .map_err(napi::Error::from_reason)
}

#[cfg(feature = "node")]
/// Get the native module version.
#[napi]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

// ─── WASM exports ──────────────────────────────────────────────

#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

#[cfg(feature = "wasm")]
/// Parse TypeScript source and generate a mock for the given type.
#[wasm_bindgen]
pub fn mock_from_source_wasm(
    source: &str,
    type_name: &str,
    options_json: &str,
) -> Result<JsValue, JsValue> {
    let options: MockOptions = if options_json.is_empty() {
        MockOptions::default()
    } else {
        serde_json::from_str(options_json)
            .map_err(|e| JsValue::from_str(&format!("Invalid options: {}", e)))?
    };
    let ctx = MockContext::from_source(source, "input.ts", options)
        .map_err(|e| JsValue::from_str(&e))?;
    let result = ctx.mock(type_name, None)
        .map_err(|e| JsValue::from_str(&e))?;
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

#[cfg(feature = "wasm")]
/// Parse TypeScript source and list all available type names.
#[wasm_bindgen]
pub fn list_types_wasm(source: &str) -> Result<JsValue, JsValue> {
    let ctx = MockContext::from_source(source, "input.ts", MockOptions::default())
        .map_err(|e| JsValue::from_str(&e))?;
    let types = ctx.list_types();
    serde_wasm_bindgen::to_value(&types)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

#[cfg(feature = "wasm")]
/// Get the module version.
#[wasm_bindgen]
pub fn version_wasm() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

