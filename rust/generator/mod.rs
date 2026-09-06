// Mock Generator — converts TypeNode into serde_json::Value

use std::collections::{HashMap, HashSet};
use serde_json::{json, Value, Map};
use crate::types::{TypeNode, LiteralValue, PropertyNode, ResolvedTypes};
use crate::types::options::MockOptions;
use crate::random::RandomGenerator;
use crate::resolver::TypeParamNames;

pub struct MockGenerator {
    resolved: ResolvedTypes,
    options: MockOptions,
    rng: RandomGenerator,
    max_depth: u32,
    array_len: u32,
    type_param_names: TypeParamNames,
}

impl MockGenerator {
    pub fn new(resolved: ResolvedTypes, options: MockOptions) -> Self {
        let rng = RandomGenerator::new(options.seed);
        let max_depth = options.effective_max_depth();
        let array_len = options.effective_array_length();
        Self { resolved, options, rng, max_depth, array_len, type_param_names: HashMap::new() }
    }

    pub fn with_type_params(mut self, type_param_names: TypeParamNames) -> Self {
        self.type_param_names = type_param_names;
        self
    }

    /// Generate a mock for a named type
    pub fn generate(&mut self, type_name: &str) -> Result<Value, String> {
        let node = self.resolved.get(type_name)
            .ok_or_else(|| format!("Type \"{}\" not found. Available: {}",
                type_name, self.resolved.keys().cloned().collect::<Vec<_>>().join(", ")))?
            .clone();
        let mut visited = HashSet::new();
        Ok(self.generate_value(&node, 0, &HashMap::new(), &mut visited))
    }

    /// Core recursive generation
    fn generate_value(
        &mut self,
        node: &TypeNode,
        depth: u32,
        subs: &HashMap<String, TypeNode>,
        visited: &mut HashSet<String>,
    ) -> Value {
        if depth > self.max_depth {
            return Value::Null;
        }
        match node {
            TypeNode::String => json!(self.rng.string()),
            TypeNode::Number => json!(self.rng.number(None, None)),
            TypeNode::Boolean => json!(self.rng.boolean()),
            TypeNode::Null => Value::Null,
            TypeNode::Undefined | TypeNode::Void => Value::Null,
            TypeNode::BigInt => json!(self.rng.number(Some(0), Some(1_000_000))),
            TypeNode::Symbol => json!(format!("mock-symbol-{}", self.rng.number(Some(0), Some(10000)))),
            TypeNode::Never => Value::Null,
            TypeNode::Any | TypeNode::Unknown => self.generate_any(),
            TypeNode::Date => json!(self.rng.date()),
            TypeNode::RegExp => json!("^mock-pattern$"),
            TypeNode::Literal { value } => self.literal_to_json(value),
            TypeNode::Array { element_type } => self.gen_array(element_type, depth, subs, visited),
            TypeNode::Tuple { elements } => {
                elements.iter().map(|e| self.generate_value(e, depth + 1, subs, visited)).collect()
            }
            TypeNode::Object { properties } => self.gen_object(properties, depth, subs, visited),
            TypeNode::Interface { name, properties, type_parameter_names: _, .. } => {
                if visited.contains(name) { return Value::Null; }
                visited.insert(name.clone());
                let r = self.gen_object(properties, depth, subs, visited);
                visited.remove(name);
                r
            }
            TypeNode::Class { name, properties, .. } => {
                if visited.contains(name) { return Value::Null; }
                visited.insert(name.clone());
                let r = self.gen_object(properties, depth, subs, visited);
                visited.remove(name);
                r
            }
            TypeNode::Enum { members, .. } => {
                if members.is_empty() { return Value::Null; }
                let value = self.rng.pick(members).value.clone();
                self.literal_to_json(&value)
            }
            TypeNode::Union { types } => {
                let non_null: Vec<&TypeNode> = types.iter()
                    .filter(|t| !matches!(t, TypeNode::Null | TypeNode::Undefined))
                    .collect();
                let pool = if non_null.is_empty() { types.iter().collect::<Vec<_>>() } else { non_null };
                if pool.is_empty() { return Value::Null; }
                let chosen = self.rng.pick(&pool);
                self.generate_value(chosen, depth, subs, visited)
            }
            TypeNode::Intersection { types } => self.gen_intersection(types, depth, subs, visited),
            TypeNode::TypeReference { name, type_arguments } => {
                self.gen_type_ref(name, type_arguments, depth, subs, visited)
            }
            TypeNode::Record { key_type, value_type } => {
                self.gen_record(key_type, value_type, depth, subs, visited)
            }
            TypeNode::Partial { inner_type } => self.gen_partial(inner_type, depth, subs, visited),
            TypeNode::Required { inner_type } => self.generate_value(inner_type, depth + 1, subs, visited),
            TypeNode::Pick { inner_type, keys } => self.gen_pick(inner_type, keys, depth, subs, visited),
            TypeNode::Omit { inner_type, keys } => self.gen_omit(inner_type, keys, depth, subs, visited),
            TypeNode::Map { key_type, value_type } => {
                self.gen_record(key_type, value_type, depth, subs, visited)
            }
            TypeNode::Set { element_type } => self.gen_set(element_type, depth, subs, visited),
            TypeNode::Promise { inner_type } => self.generate_value(inner_type, depth + 1, subs, visited),
            TypeNode::Optional { inner_type } => {
                if self.rng.boolean() {
                    self.generate_value(inner_type, depth + 1, subs, visited)
                } else {
                    Value::Null
                }
            }
            TypeNode::Function { .. } => {
                // Functions can't be serialized to JSON, return null
                Value::Null
            }
        }
    }

    fn literal_to_json(&self, v: &LiteralValue) -> Value {
        match v {
            LiteralValue::String(s) => json!(s),
            LiteralValue::Number(n) => json!(n),
            LiteralValue::Boolean(b) => json!(b),
        }
    }

    fn generate_any(&mut self) -> Value {
        json!({"id": self.rng.string(), "value": self.rng.number(None, None), "active": self.rng.boolean()})
    }

    fn gen_object(
        &mut self, props: &[PropertyNode], depth: u32,
        subs: &HashMap<String, TypeNode>, visited: &mut HashSet<String>,
    ) -> Value {
        let include_opt = self.options.effective_include_optional();
        let mut map = Map::new();
        for p in props {
            if p.optional && !include_opt && self.rng.boolean() { continue; }
            map.insert(p.name.clone(), self.generate_value(&p.type_node, depth + 1, subs, visited));
        }
        if let Some(overrides) = &self.options.overrides {
            if let Value::Object(ov) = overrides {
                for (k, v) in ov { if map.contains_key(k) { map.insert(k.clone(), v.clone()); } }
            }
        }
        Value::Object(map)
    }

    fn gen_array(&mut self, elem: &TypeNode, depth: u32, subs: &HashMap<String, TypeNode>, visited: &mut HashSet<String>) -> Value {
        (0..self.array_len).map(|_| self.generate_value(elem, depth + 1, subs, visited)).collect()
    }

    fn gen_intersection(&mut self, types: &[TypeNode], depth: u32, subs: &HashMap<String, TypeNode>, visited: &mut HashSet<String>) -> Value {
        let mut merged = Map::new();
        for t in types {
            if let Value::Object(obj) = self.generate_value(t, depth + 1, subs, visited) {
                for (k, v) in obj { merged.insert(k, v); }
            }
        }
        Value::Object(merged)
    }

    fn gen_type_ref(&mut self, name: &str, type_args: &[TypeNode], depth: u32, subs: &HashMap<String, TypeNode>, visited: &mut HashSet<String>) -> Value {
        if let Some(sub_node) = subs.get(name) {
            return self.generate_value(sub_node, depth, subs, visited);
        }
        if let Some(resolved_node) = self.resolved.get(name).cloned() {
            let new_subs = self.build_subs(name, &resolved_node, type_args);
            let mut merged = subs.clone();
            merged.extend(new_subs);
            // Don't increment depth — TypeReference is a named alias, not real nesting
            return self.generate_value(&resolved_node, depth, &merged, visited);
        }
        json!(format!("<unresolved:{}>", name))
    }

    fn build_subs(&self, type_name: &str, node: &TypeNode, args: &[TypeNode]) -> HashMap<String, TypeNode> {
        let mut m = HashMap::new();
        if args.is_empty() { return m; }

        // Get parameter names: first from the node itself (Interface), then from type_param_names map
        let param_names: Option<&Vec<String>> = match node {
            TypeNode::Interface { type_parameter_names, .. } if !type_parameter_names.is_empty() => {
                Some(type_parameter_names)
            }
            _ => self.type_param_names.get(type_name),
        };

        if let Some(names) = param_names {
            for (i, pn) in names.iter().enumerate() {
                if let Some(arg) = args.get(i) {
                    m.insert(pn.clone(), arg.clone());
                }
            }
        }
        m
    }

    fn gen_record(&mut self, kt: &TypeNode, vt: &TypeNode, depth: u32, subs: &HashMap<String, TypeNode>, visited: &mut HashSet<String>) -> Value {
        let mut map = Map::new();
        for i in 0..self.array_len {
            let key = self.gen_key_string(kt, i as usize, depth, subs, visited);
            map.insert(key, self.generate_value(vt, depth + 1, subs, visited));
        }
        Value::Object(map)
    }

    fn gen_key_string(&mut self, kt: &TypeNode, idx: usize, depth: u32, subs: &HashMap<String, TypeNode>, visited: &mut HashSet<String>) -> String {
        match kt {
            TypeNode::Literal { value: LiteralValue::String(s) } => s.clone(),
            TypeNode::Union { types } => {
                let lits: Vec<_> = types.iter().filter(|t| matches!(t, TypeNode::Literal { value: LiteralValue::String(_) })).collect();
                if let Some(TypeNode::Literal { value: LiteralValue::String(s) }) = lits.get(idx) { return s.clone(); }
                format!("key_{}", idx)
            }
            _ => match self.generate_value(kt, depth + 1, subs, visited) {
                Value::String(s) => s,
                other => other.to_string(),
            }
        }
    }

    fn gen_set(&mut self, elem: &TypeNode, depth: u32, subs: &HashMap<String, TypeNode>, visited: &mut HashSet<String>) -> Value {
        let mut arr = Vec::new();
        let mut seen = HashSet::new();
        for _ in 0..self.array_len {
            let val = self.generate_value(elem, depth + 1, subs, visited);
            if seen.insert(val.to_string()) { arr.push(val); }
        }
        Value::Array(arr)
    }

    fn gen_partial(&mut self, inner: &TypeNode, depth: u32, subs: &HashMap<String, TypeNode>, visited: &mut HashSet<String>) -> Value {
        let val = self.generate_value(inner, depth + 1, subs, visited);
        if let Value::Object(obj) = val {
            let mut r = Map::new();
            for (k, v) in obj { if self.rng.boolean() { r.insert(k, v); } }
            Value::Object(r)
        } else { val }
    }

    fn gen_pick(&mut self, inner: &TypeNode, keys: &[String], depth: u32, subs: &HashMap<String, TypeNode>, visited: &mut HashSet<String>) -> Value {
        let val = self.generate_value(inner, depth + 1, subs, visited);
        if let Value::Object(obj) = val {
            let mut r = Map::new();
            for k in keys { if let Some(v) = obj.get(k) { r.insert(k.clone(), v.clone()); } }
            Value::Object(r)
        } else { val }
    }

    fn gen_omit(&mut self, inner: &TypeNode, keys: &[String], depth: u32, subs: &HashMap<String, TypeNode>, visited: &mut HashSet<String>) -> Value {
        let val = self.generate_value(inner, depth + 1, subs, visited);
        if let Value::Object(obj) = val {
            Value::Object(obj.into_iter().filter(|(k, _)| !keys.contains(k)).collect())
        } else { val }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::parse_source;
    use crate::resolver::TypeResolver;

    fn gen_mock(source: &str, type_name: &str) -> Value {
        let decls = parse_source(source, "test.ts").unwrap();
        let resolved = TypeResolver::new(decls).resolve_all();
        let mut gen = MockGenerator::new(resolved, MockOptions { seed: Some(42), ..Default::default() });
        gen.generate(type_name).unwrap()
    }

    #[test]
    fn test_gen_interface() {
        let val = gen_mock("interface U { name: string; age: number; }", "U");
        let obj = val.as_object().unwrap();
        assert!(obj["name"].is_string());
        assert!(obj["age"].is_number());
    }

    #[test]
    fn test_gen_enum() {
        let val = gen_mock(r#"enum C { R = "RED", G = "GREEN", B = "BLUE" }"#, "C");
        assert!(["RED", "GREEN", "BLUE"].contains(&val.as_str().unwrap()));
    }

    #[test]
    fn test_gen_union_literal() {
        let val = gen_mock(r#"type S = "a" | "b" | "c";"#, "S");
        assert!(val.is_string());
    }

    #[test]
    fn test_gen_array() {
        let val = gen_mock("type L = string[];", "L");
        assert!(val.is_array());
        assert_eq!(val.as_array().unwrap().len(), 2);
    }

    #[test]
    fn test_gen_nested() {
        let val = gen_mock("interface A { s: string; }\ninterface C { a: A; }", "C");
        assert!(val["a"].is_object());
    }

    #[test]
    fn test_gen_extends() {
        let val = gen_mock("interface B { id: string; }\ninterface U extends B { n: string; }", "U");
        let obj = val.as_object().unwrap();
        assert!(obj.contains_key("id"));
        assert!(obj.contains_key("n"));
    }

    #[test]
    fn test_gen_tuple() {
        let val = gen_mock("type T = [string, number, boolean];", "T");
        let arr = val.as_array().unwrap();
        assert_eq!(arr.len(), 3);
        assert!(arr[0].is_string() && arr[1].is_number() && arr[2].is_boolean());
    }

    #[test]
    fn test_deterministic() {
        let src = "interface U { name: string; age: number; }";
        assert_eq!(gen_mock(src, "U"), gen_mock(src, "U"));
    }
}
