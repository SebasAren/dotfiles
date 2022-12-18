import subprocess
from libqtile.widget.volume import Volume


class WireplumberVolume(Volume):
    def get_volume(self):
        try:
            a = self.call_process(["wpctl", "get-volume", "@DEFAULT_AUDIO_SINK@"])
            if a.startswith("Volume: "):
                volume = float(a[8:])
                return volume * 100
            else:
                return -1
        except subprocess.CalledProcessError:
            return -1
