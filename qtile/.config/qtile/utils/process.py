import os
from pathlib import Path
import subprocess
import shlex
from libqtile.log_utils import logger


def run(cmd: str):
    """Run a process"""
    subprocess.Popen(shlex.split(cmd))


def run_script(src: str):
    """Run a script from the qtile config dir"""
    path = Path(os.path.expanduser("~"), ".config/qtile", src)
    a = subprocess.Popen(str(path))
    logger.info(a)
