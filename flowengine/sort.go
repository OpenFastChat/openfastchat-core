// SPDX-FileCopyrightText: 2026 Bart van de Lint <bart@vandelint.net>
//
// SPDX-License-Identifier: AGPL-3.0-only

package flowengine

import "fmt"

// cycleError is returned when a cycle is found whose
// back-edge does not originate at a yes/no node — i.e.
// the loop has no decision point to exit through.
type cycleError struct {
	nodeID string
}

func (e *cycleError) Error() string {
	return fmt.Sprintf(
		"cycle detected through node %s", e.nodeID,
	)
}

func TopologicalSortWithBackEdges(
	def FlowDefinition,
) ([]string, map[string]bool, error) {
	nodeByID := make(map[string]*FlowNode, len(def.Nodes))
	for i := range def.Nodes {
		nodeByID[def.Nodes[i].ID] = &def.Nodes[i]
	}

	type outEdge struct {
		edgeID string
		target string
	}
	adj := make(map[string][]outEdge, len(def.Nodes))
	for _, e := range def.Edges {
		adj[e.Source] = append(adj[e.Source], outEdge{
			edgeID: e.ID,
			target: e.Target,
		})
	}

	state := make(map[string]int8, len(def.Nodes))
	const (
		unvisited int8 = 0
		gray      int8 = 1
		black     int8 = 2
	)

	backEdges := make(map[string]bool)
	var order []string

	var visit func(id string) error
	visit = func(id string) error {
		switch state[id] {
		case black:
			return nil
		case gray:
			return fmt.Errorf(
				"cycle detected through node %s", id,
			)
		}
		state[id] = gray
		for _, e := range adj[id] {
			if state[e.target] == gray {
				src := nodeByID[id]
				if src != nil && isChoiceNode(src.Type) {
					backEdges[e.edgeID] = true
					continue
				}
				return &cycleError{nodeID: id}
			}
			if err := visit(e.target); err != nil {
				return err
			}
		}
		state[id] = black
		order = append(order, id)
		return nil
	}

	for _, n := range def.Nodes {
		if state[n.ID] == unvisited {
			if err := visit(n.ID); err != nil {
				return nil, nil, err
			}
		}
	}

	for i, j := 0, len(order)-1; i < j; i, j = i+1, j-1 {
		order[i], order[j] = order[j], order[i]
	}

	return order, backEdges, nil
}
