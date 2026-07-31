package main

import (
	"reflect"
	"testing"
)

func TestBSTCandidate(t *testing.T) {
	b := &BST{}
	if b.Search(5) || b.Height() != 0 || len(b.InOrder()) != 0 {
		t.Fatal("empty-tree behavior failed")
	}
	for _, value := range []int{5, 3, 7, 1, 4, 6, 8, 5} {
		b.Insert(value)
	}
	if !b.Search(1) || !b.Search(8) || b.Search(99) {
		t.Fatal("search behavior failed")
	}
	if got, want := b.InOrder(), []int{1, 3, 4, 5, 6, 7, 8}; !reflect.DeepEqual(got, want) {
		t.Fatalf("in-order got %v want %v", got, want)
	}
	if b.Height() != 3 {
		t.Fatalf("height got %d want 3", b.Height())
	}
	one := &BST{}
	one.Insert(42)
	if one.Height() != 1 {
		t.Fatalf("single-node height got %d want 1", one.Height())
	}
}
