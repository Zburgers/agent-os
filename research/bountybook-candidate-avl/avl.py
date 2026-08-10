class _Node:
    __slots__ = ("key", "left", "right", "height")

    def __init__(self, key: int):
        self.key = key
        self.left = None
        self.right = None
        self.height = 1


class AVLTree:
    def __init__(self):
        self.root = None

    @staticmethod
    def _height(node):
        return node.height if node else 0

    @classmethod
    def _refresh(cls, node):
        node.height = 1 + max(cls._height(node.left), cls._height(node.right))

    @classmethod
    def _rotate_right(cls, node):
        pivot = node.left
        middle = pivot.right
        pivot.right = node
        node.left = middle
        cls._refresh(node)
        cls._refresh(pivot)
        return pivot

    @classmethod
    def _rotate_left(cls, node):
        pivot = node.right
        middle = pivot.left
        pivot.left = node
        node.right = middle
        cls._refresh(node)
        cls._refresh(pivot)
        return pivot

    @classmethod
    def _rebalance(cls, node):
        cls._refresh(node)
        balance = cls._height(node.left) - cls._height(node.right)
        if balance > 1:
            if cls._height(node.left.left) < cls._height(node.left.right):
                node.left = cls._rotate_left(node.left)
            return cls._rotate_right(node)
        if balance < -1:
            if cls._height(node.right.right) < cls._height(node.right.left):
                node.right = cls._rotate_right(node.right)
            return cls._rotate_left(node)
        return node

    @classmethod
    def _insert(cls, node, key):
        if node is None:
            return _Node(key)
        if key < node.key:
            node.left = cls._insert(node.left, key)
        elif key > node.key:
            node.right = cls._insert(node.right, key)
        else:
            return node
        return cls._rebalance(node)

    def insert(self, key: int) -> None:
        self.root = self._insert(self.root, key)

    @classmethod
    def _minimum(cls, node):
        while node.left:
            node = node.left
        return node

    @classmethod
    def _delete(cls, node, key):
        if node is None:
            return None
        if key < node.key:
            node.left = cls._delete(node.left, key)
        elif key > node.key:
            node.right = cls._delete(node.right, key)
        else:
            if node.left is None:
                return node.right
            if node.right is None:
                return node.left
            successor = cls._minimum(node.right)
            node.key = successor.key
            node.right = cls._delete(node.right, successor.key)
        return cls._rebalance(node)

    def delete(self, key: int) -> None:
        self.root = self._delete(self.root, key)

    def search(self, key: int) -> bool:
        node = self.root
        while node:
            if key == node.key:
                return True
            node = node.left if key < node.key else node.right
        return False

    def inorder(self) -> list[int]:
        result = []

        def visit(node):
            if node:
                visit(node.left)
                result.append(node.key)
                visit(node.right)

        visit(self.root)
        return result

    def height(self) -> int:
        return self._height(self.root)


if __name__ == "__main__":
    from test_avl import test_required_bountybook_cases

    test_required_bountybook_cases()
    print("All tests passed")
