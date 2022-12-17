from libqtile import bar
from libqtile.widget.tasklist import TaskList


def task_bar():
    return bar.Bar([TaskList()], 24)
