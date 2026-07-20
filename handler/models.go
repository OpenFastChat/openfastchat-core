package handler

import (
	"encoding/json"
	"net/http"
	"sort"

	"github.com/1-Bart-1/openfastchat-core/coreconfig"
)

type modelInfo struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

func ModelsHandler(w http.ResponseWriter, r *http.Request) {
	models := make([]modelInfo, 0, len(coreconfig.Models))
	for id, cfg := range coreconfig.Models {
		models = append(models, modelInfo{ID: id, Label: cfg.Label})
	}
	sort.Slice(models, func(i, j int) bool { return models[i].ID < models[j].ID })
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(models)
}
