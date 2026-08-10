import math

from avl import AVLTree


def test_required_bountybook_cases():
    tree = AVLTree()
    for value in [30, 20, 40, 10, 25, 35, 50]:
        tree.insert(value)

    assert tree.inorder() == [10, 20, 25, 30, 35, 40, 50]
    assert tree.height() <= math.ceil(math.log2(8)) + 1
    assert tree.search(25) is True
    assert tree.search(99) is False

    tree.delete(20)
    assert tree.inorder() == [10, 25, 30, 35, 40, 50]
    assert tree.search(20) is False

    right_left = AVLTree()
    for value in [10, 30, 20]:
        right_left.insert(value)
    assert right_left.inorder() == [10, 20, 30]
    assert right_left.height() == 2


if __name__ == "__main__":
    test_required_bountybook_cases()
    print("All tests passed")
