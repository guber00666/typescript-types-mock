#![deny(clippy::all)]

// Internal modules
mod types;
mod random;
mod parser;

#[cfg(test)]
mod parser_integration_test;

use napi_derive::napi;

// Re-export types for use in other modules
pub use types::*;
pub use random::RandomGenerator;
pub use parser::{parse_file, parse_source, Declaration};

/// Test function to verify napi-rs setup
#[napi]
pub fn hello() -> String {
    "Hello from Rust! typescript-types-mock v1.0.1".to_string()
}

/// Test function with parameters
#[napi]
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}
