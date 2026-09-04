#![deny(clippy::all)]

// typescript-types-mock — Rust native core
// High-performance TypeScript type mocking via napi-rs + SWC

mod types;
mod random;
mod parser;
mod resolver;
mod generator;
mod context;

#[cfg(test)]
mod parser_integration_test;

use napi_derive::napi;

pub use types::*;
pub use random::RandomGenerator;
pub use parser::{parse_file, parse_source, Declaration};
pub use resolver::TypeResolver;
pub use generator::MockGenerator;
pub use context::MockContext;

use serde_json::Value;
use types::options::MockOptions;

// ─── napi exports ──────────────────────────────────────────────

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

/// List all type names in a .ts file.
#[napi]
pub fn list_types(file_path: String) -> napi::Result<Vec<String>> {
    let ctx = MockContext::new(&file_path, MockOptions::default())
        .map_err(napi::Error::from_reason)?;
    Ok(ctx.list_types())
}

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

/// Get the native module version.
#[napi]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

