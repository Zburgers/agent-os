package main

// Node is one integer-valued binary-search-tree node.
type Node struct {
	Val         int
	Left, Right *Node
}

// BST stores the root of an integer binary search tree.
type BST struct {
	Root *Node
}

// Insert adds val. Duplicate values are ignored.
func (b *BST) Insert(val int) {
	if b.Root == nil {
		b.Root = &Node{Val: val}
		return
	}
	cur := b.Root
	for {
		if val == cur.Val {
			return
		}
		if val < cur.Val {
			if cur.Left == nil {
				cur.Left = &Node{Val: val}
				return
			}
			cur = cur.Left
			continue
		}
		if cur.Right == nil {
			cur.Right = &Node{Val: val}
			return
		}
		cur = cur.Right
	}
}

// Search reports whether val exists in the tree.
func (b *BST) Search(val int) bool {
	for cur := b.Root; cur != nil; {
		if val == cur.Val {
			return true
		}
		if val < cur.Val {
			cur = cur.Left
		} else {
			cur = cur.Right
		}
	}
	return false
}

// InOrder returns a new ascending slice containing every tree value.
func (b *BST) InOrder() []int {
	values := make([]int, 0)
	var visit func(*Node)
	visit = func(node *Node) {
		if node == nil {
			return
		}
		visit(node.Left)
		values = append(values, node.Val)
		visit(node.Right)
	}
	visit(b.Root)
	return values
}

// Height returns the number of nodes on the longest root-to-leaf path.
func (b *BST) Height() int {
	var height func(*Node) int
	height = func(node *Node) int {
		if node == nil {
			return 0
		}
		left, right := height(node.Left), height(node.Right)
		if left > right {
			return left + 1
		}
		return right + 1
	}
	return height(b.Root)
}

func main() {}
