// MockContext — caching wrapper around resolver + generator.
// Parses the file once, reuses resolved types across calls.

use serde_json::Value;
use crate::parser;
use crate::resolver::{TypeResolver, TypeParamNames};
use crate::generator::MockGenerator;
use crate::types::options::MockOptions;
use crate::types::ResolvedTypes;

pub struct MockContext {
    file_path: String,
    resolved: ResolvedTypes,
    type_param_names: TypeParamNames,
    default_options: MockOptions,
}

impl MockContext {
    /// Create a new context by parsing the given file.
    #[cfg(not(target_arch = "wasm32"))]
    pub fn new(file_path: &str, options: MockOptions) -> Result<Self, String> {
        let declarations = parser::parse_file(file_path)?;
        let resolver = TypeResolver::new(declarations);
        let type_param_names = resolver.resolve_type_params();
        let resolved = resolver.resolve_all();
        Ok(Self { file_path: file_path.to_string(), resolved, type_param_names, default_options: options })
    }

    /// Create a context from TypeScript source code (for testing).
    pub fn from_source(source: &str, file_path: &str, options: MockOptions) -> Result<Self, String> {
        let declarations = parser::parse_source(source, file_path)?;
        let resolver = TypeResolver::new(declarations);
        let type_param_names = resolver.resolve_type_params();
        let resolved = resolver.resolve_all();
        Ok(Self { file_path: file_path.to_string(), resolved, type_param_names, default_options: options })
    }

    /// Generate a single mock.
    pub fn mock(&self, type_name: &str, options: Option<MockOptions>) -> Result<Value, String> {
        if !self.resolved.contains_key(type_name) {
            return Err(format!(
                "Type \"{}\" not found in \"{}\". Available: {}",
                type_name, self.file_path,
                self.resolved.keys().cloned().collect::<Vec<_>>().join(", ")
            ));
        }
        let opts = options.unwrap_or_else(|| self.default_options.clone());
        let mut gen = MockGenerator::new(self.resolved.clone(), opts)
            .with_type_params(self.type_param_names.clone());
        gen.generate(type_name)
    }

    /// Generate multiple mocks.
    pub fn many(&self, type_name: &str, count: u32, options: Option<MockOptions>) -> Result<Vec<Value>, String> {
        let opts = options.unwrap_or_else(|| self.default_options.clone());
        let mut gen = MockGenerator::new(self.resolved.clone(), opts)
            .with_type_params(self.type_param_names.clone());
        let mut results = Vec::with_capacity(count as usize);
        for _ in 0..count {
            results.push(gen.generate(type_name)?);
        }
        Ok(results)
    }

    /// List all available type names.
    pub fn list_types(&self) -> Vec<String> {
        self.resolved.keys().cloned().collect()
    }

    /// Get the file path.
    pub fn file_path(&self) -> &str {
        &self.file_path
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_context_mock() {
        let src = "interface User { name: string; age: number; email: string; }";
        let ctx = MockContext::from_source(src, "test.ts", MockOptions { seed: Some(42), ..Default::default() }).unwrap();
        let val = ctx.mock("User", None).unwrap();
        assert!(val.is_object());
        assert!(val["name"].is_string());
    }

    #[test]
    fn test_context_many() {
        let src = "interface User { name: string; }";
        let ctx = MockContext::from_source(src, "test.ts", MockOptions::default()).unwrap();
        let vals = ctx.many("User", 5, None).unwrap();
        assert_eq!(vals.len(), 5);
    }

    #[test]
    fn test_context_list_types() {
        let src = "interface A {}\ninterface B {}\ntype C = string;";
        let ctx = MockContext::from_source(src, "test.ts", MockOptions::default()).unwrap();
        let types = ctx.list_types();
        assert!(types.contains(&"A".to_string()));
        assert!(types.contains(&"B".to_string()));
        assert!(types.contains(&"C".to_string()));
    }

    #[test]
    fn test_context_not_found() {
        let src = "interface A {}";
        let ctx = MockContext::from_source(src, "test.ts", MockOptions::default()).unwrap();
        assert!(ctx.mock("Missing", None).is_err());
    }

    #[test]
    fn test_generic_type_alias() {
        let src = r#"
            type Wrapper<T> = { value: T; label: string };
            type StringWrapper = Wrapper<string>;
        "#;
        let ctx = MockContext::from_source(src, "test.ts", MockOptions { seed: Some(42), ..Default::default() }).unwrap();
        let val = ctx.mock("StringWrapper", None).unwrap();
        assert!(val.is_object());
        assert!(val["value"].is_string());
        assert!(val["label"].is_string());
    }

    #[test]
    fn test_generic_interface() {
        let src = r#"
            interface ApiResponse<T> {
                data: T;
                status: number;
            }
            interface User { name: string; }
            type UserResponse = ApiResponse<User>;
        "#;
        let ctx = MockContext::from_source(src, "test.ts", MockOptions { seed: Some(42), ..Default::default() }).unwrap();
        let val = ctx.mock("UserResponse", None).unwrap();
        assert!(val.is_object());
        assert!(val["data"].is_object());
        assert!(val["data"]["name"].is_string());
        assert!(val["status"].is_number());
    }

    #[test]
    fn test_nested_generics() {
        let src = r#"
            type Box<T> = { inner: T };
            type Pair<A, B> = { first: A; second: B };
            type NestedPair = Pair<Box<string>, number>;
        "#;
        let ctx = MockContext::from_source(src, "test.ts", MockOptions { seed: Some(42), ..Default::default() }).unwrap();
        let val = ctx.mock("NestedPair", None).unwrap();
        assert!(val.is_object());
        assert!(val["first"].is_object());
        assert!(val["first"]["inner"].is_string());
        assert!(val["second"].is_number());
    }
}
