// Package usernames generates random adjective_noun display names.
package usernames

import (
	"math/rand/v2"
)

var adjectives = []string{
	"wandering", "silent", "dancing", "clever", "boring",
	"radiant", "quiet", "boundless", "amber", "crimson",
	"sapphire", "verdant", "shimmering", "drifting", "fearless",
	"gentle", "stoic", "whispering", "glacial", "ember",
	"midnight", "twilight", "noble", "humble", "wandering",
	"electric", "lucid", "merry", "tranquil", "bold",
	"hidden", "wise", "feral", "swift", "patient",
	"placid", "rugged", "tender", "wistful", "spry",
	"valiant", "zesty", "azure", "scarlet", "ivory",
	"bronze", "copper", "obsidian", "jade", "pearl",
	"velvet", "mossy", "rustic", "subtle", "candid",
	"jovial", "buoyant", "kindly", "lofty", "modest",
	"polished", "quirky", "rowdy", "savvy", "tidy",
	"upbeat", "vivid", "witty", "yonder", "zealous",
	"breezy", "cheery", "dapper", "earnest", "frosty",
	"glowing", "hearty", "icy", "jaunty", "keen",
}

var nouns = []string{
	"orchid", "meteor", "phoenix", "comet", "willow",
	"falcon", "ember", "ocean", "harbor", "lantern",
	"thicket", "valley", "summit", "tundra", "river",
	"meadow", "canyon", "cinder", "horizon", "echo",
	"rune", "saga", "petal", "gust", "ridge",
	"sparrow", "otter", "fern", "cedar", "spruce",
	"linnet", "oryx", "kestrel", "mantis", "puffin",
	"raven", "swan", "thrush", "vireo", "wren",
	"badger", "bison", "caribou", "dolphin", "fox",
	"giraffe", "heron", "ibex", "jaguar", "koala",
	"lemur", "marmot", "newt", "owl", "panda",
	"quail", "ram", "stoat", "turtle", "urchin",
	"vole", "weasel", "yak", "zebra", "antler",
	"birch", "cliff", "dune", "fjord", "geyser",
	"hill", "isle", "knoll", "lagoon", "marsh",
	"oasis", "pebble", "quartz", "reef", "sandbar",
}

// Generate returns a random adjective_noun display name. Uniqueness is not
// guaranteed; collisions are acceptable.
func Generate() string {
	a := adjectives[rand.IntN(len(adjectives))]
	n := nouns[rand.IntN(len(nouns))]
	return a + "_" + n
}
