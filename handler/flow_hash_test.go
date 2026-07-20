package handler

import (
	"encoding/json"
	"testing"
)

func TestCanonicalFlowHash_PositionInvariant(t *testing.T) {
	defA := json.RawMessage(`{
		"nodes":[
			{"id":"a","type":"llm","position":{"x":10,"y":20},"data":{"model":"m"}},
			{"id":"b","type":"user_prompt","position":{"x":0,"y":0},"data":{}}
		],
		"edges":[{"id":"e1","source":"b","target":"a"}]
	}`)
	defB := json.RawMessage(`{
		"nodes":[
			{"id":"a","type":"llm","position":{"x":999,"y":999},"data":{"model":"m"}},
			{"id":"b","type":"user_prompt","position":{"x":111,"y":222},"data":{}}
		],
		"edges":[{"id":"e1","source":"b","target":"a"}]
	}`)
	a, err := canonicalFlowHash(defA)
	if err != nil {
		t.Fatal(err)
	}
	b, err := canonicalFlowHash(defB)
	if err != nil {
		t.Fatal(err)
	}
	if a != b {
		t.Fatalf("position-only change altered hash: %s vs %s", a, b)
	}
}

func TestCanonicalFlowHash_NodeOrderInvariant(t *testing.T) {
	defA := json.RawMessage(`{
		"nodes":[
			{"id":"a","type":"llm","data":{}},
			{"id":"b","type":"user_prompt","data":{}}
		],
		"edges":[{"id":"e1","source":"b","target":"a"}]
	}`)
	defB := json.RawMessage(`{
		"nodes":[
			{"id":"b","type":"user_prompt","data":{}},
			{"id":"a","type":"llm","data":{}}
		],
		"edges":[{"id":"e1","source":"b","target":"a"}]
	}`)
	a, _ := canonicalFlowHash(defA)
	b, _ := canonicalFlowHash(defB)
	if a != b {
		t.Fatalf("node reordering altered hash: %s vs %s", a, b)
	}
}

func TestCanonicalFlowHash_DataKeyOrderInvariant(t *testing.T) {
	defA := json.RawMessage(`{
		"nodes":[{"id":"a","type":"llm","data":{"model":"m","temperature":0.7}}],
		"edges":[]
	}`)
	defB := json.RawMessage(`{
		"nodes":[{"id":"a","type":"llm","data":{"temperature":0.7,"model":"m"}}],
		"edges":[]
	}`)
	a, _ := canonicalFlowHash(defA)
	b, _ := canonicalFlowHash(defB)
	if a != b {
		t.Fatalf("data key reordering altered hash: %s vs %s", a, b)
	}
}

func TestCanonicalFlowHash_StructuralChangeAltersHash(t *testing.T) {
	defA := json.RawMessage(`{
		"nodes":[{"id":"a","type":"llm","data":{"model":"m"}}],
		"edges":[]
	}`)
	defB := json.RawMessage(`{
		"nodes":[{"id":"a","type":"llm","data":{"model":"x"}}],
		"edges":[]
	}`)
	a, _ := canonicalFlowHash(defA)
	b, _ := canonicalFlowHash(defB)
	if a == b {
		t.Fatalf("data change should change hash")
	}
}

func TestCanonicalFlowHash_EdgeHandle(t *testing.T) {
	defA := json.RawMessage(`{
		"nodes":[],
		"edges":[{"id":"e1","source":"a","target":"b","sourceHandle":"yes"}]
	}`)
	defB := json.RawMessage(`{
		"nodes":[],
		"edges":[{"id":"e1","source":"a","target":"b","sourceHandle":"no"}]
	}`)
	a, _ := canonicalFlowHash(defA)
	b, _ := canonicalFlowHash(defB)
	if a == b {
		t.Fatalf("sourceHandle change should change hash")
	}
}

func TestCanonicalFlowHash_EmptyDef(t *testing.T) {
	h, err := canonicalFlowHash(nil)
	if err != nil {
		t.Fatal(err)
	}
	if h == "" {
		t.Fatal("expected non-empty hash")
	}
}
