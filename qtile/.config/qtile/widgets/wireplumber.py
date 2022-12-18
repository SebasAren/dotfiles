import subprocess
import shlex
from libqtile.widget.volume import Volume


class WireplumberVolume(Volume):
    def get_volume(self):
        try:
            a = self.call_process(["wpctl", "get-volume", "@DEFAULT_AUDIO_SINK@"])
        except subprocess.CalledProcessError:
            return -1
        try:
            if a.startswith("Volume: "):
                volume = float(a[8:])
                return volume * 100
            else:
                return -1
        except ValueError:
            return -1

    def cmd_mute(self):
        subprocess.call(shlex.split("wpctl set-mute @DEFAULT_AUDIO_SOURCE@ toggle"))

    def cmd_decrease_vol(self):
        subprocess.call(shlex.split("wpctl set-volume @DEFAULT_AUDIO_SINK@ 5%-"))

    def cmd_increase_vol(self):
        subprocess.call(shlex.split("wpctl set-volume @DEFAULT_AUDIO_SINK@ 5%+"))
