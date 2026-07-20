package handler

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"sort"
)

type canonicalNode struct {
	ID   string         `json:"id"`
	Type string         `json:"type"`
	Data map[string]any `json:"data"`
}

type canonicalEdge struct {
	ID           string `json:"id"`
	Source       string `json:"source"`
	Target       string `json:"target"`
	SourceHandle string `json:"sourceHandle"`
}

type canonicalDef struct {
	Nodes []canonicalNode `json:"nodes"`
	Edges []canonicalEdge `json:"edges"`
}

func canonicalFlowHash(definition json.RawMessage) (string, error) {
	var raw struct {
		Nodes []struct {
			ID   string         `json:"id"`
			Type string         `json:"type"`
			Data map[string]any `json:"data"`
		} `json:"nodes"`
		Edges []struct {
			ID           string `json:"id"`
			Source       string `json:"source"`
			Target       string `json:"target"`
			SourceHandle string `json:"sourceHandle"`
		} `json:"edges"`
	}
	if len(definition) == 0 {
		raw.Nodes = nil
		raw.Edges = nil
	} else if err := json.Unmarshal(definition, &raw); err != nil {
		return "", err
	}

	out := canonicalDef{
		Nodes: make([]canonicalNode, len(raw.Nodes)),
		Edges: make([]canonicalEdge, len(raw.Edges)),
	}
	for i, n := range raw.Nodes {
		out.Nodes[i] = canonicalNode{
			ID:   n.ID,
			Type: n.Type,
			Data: sortMap(n.Data),
		}
	}
	for i, e := range raw.Edges {
		out.Edges[i] = canonicalEdge{
			ID:           e.ID,
			Source:       e.Source,
			Target:       e.Target,
			SourceHandle: e.SourceHandle,
		}
	}
	sort.Slice(out.Nodes, func(i, j int) bool {
		return out.Nodes[i].ID < out.Nodes[j].ID
	})
	sort.Slice(out.Edges, func(i, j int) bool {
		return out.Edges[i].ID < out.Edges[j].ID
	})

	buf, err := marshalSorted(out)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(buf)
	return hex.EncodeToString(sum[:]), nil
}

func sortMap(m map[string]any) map[string]any {
	if m == nil {
		return map[string]any{}
	}
	out := make(map[string]any, len(m))
	for k, v := range m {
		if sub, ok := v.(map[string]any); ok {
			out[k] = sortMap(sub)
		} else {
			out[k] = v
		}
	}
	return out
}

func marshalSorted(v any) ([]byte, error) {
	buf, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	var generic any
	if err := json.Unmarshal(buf, &generic); err != nil {
		return nil, err
	}
	return marshalCanonical(generic)
}

func marshalCanonical(v any) ([]byte, error) {
	switch t := v.(type) {
	case map[string]any:
		keys := make([]string, 0, len(t))
		for k := range t {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		out := []byte{'{'}
		for i, k := range keys {
			if i > 0 {
				out = append(out, ',')
			}
			kb, err := json.Marshal(k)
			if err != nil {
				return nil, err
			}
			out = append(out, kb...)
			out = append(out, ':')
			vb, err := marshalCanonical(t[k])
			if err != nil {
				return nil, err
			}
			out = append(out, vb...)
		}
		out = append(out, '}')
		return out, nil
	case []any:
		out := []byte{'['}
		for i, el := range t {
			if i > 0 {
				out = append(out, ',')
			}
			eb, err := marshalCanonical(el)
			if err != nil {
				return nil, err
			}
			out = append(out, eb...)
		}
		out = append(out, ']')
		return out, nil
	default:
		return json.Marshal(v)
	}
}
