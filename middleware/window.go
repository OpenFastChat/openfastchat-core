package middleware

import (
	"sync"
	"time"
)

type slidingWindow struct {
	mu        sync.Mutex
	hits      map[string][]time.Time
	lastSweep time.Time
	maxWindow time.Duration
}

func newSlidingWindow(maxWindow time.Duration) *slidingWindow {
	return &slidingWindow{
		hits:      make(map[string][]time.Time),
		lastSweep: time.Now(),
		maxWindow: maxWindow,
	}
}

func (s *slidingWindow) allow(key string, max int, window time.Duration) bool {
	return s.allowAt(key, max, window, time.Now())
}

func (s *slidingWindow) allowAt(key string, max int, window time.Duration, now time.Time) bool {
	if key == "" || max <= 0 {
		return true
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sweepLocked(now)
	cutoff := now.Add(-window)
	kept := s.hits[key][:0]
	for _, t := range s.hits[key] {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}
	if len(kept) >= max {
		s.hits[key] = kept
		return false
	}
	s.hits[key] = append(kept, now)
	return true
}

func (s *slidingWindow) sweepLocked(now time.Time) {
	if now.Sub(s.lastSweep) < s.maxWindow {
		return
	}
	cutoff := now.Add(-s.maxWindow)
	for key, times := range s.hits {
		kept := times[:0]
		for _, t := range times {
			if t.After(cutoff) {
				kept = append(kept, t)
			}
		}
		if len(kept) == 0 {
			delete(s.hits, key)
		} else {
			s.hits[key] = kept
		}
	}
	s.lastSweep = now
}
