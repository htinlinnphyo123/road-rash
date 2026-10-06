"""Generate original small mono WAV effects; no downloaded sound assets."""
import math, random, struct, wave
from pathlib import Path
out = Path(__file__).resolve().parents[1] / 'public' / 'audio'
out.mkdir(parents=True, exist_ok=True)
rate = 22050
random.seed(1337)
def save(name, seconds, sample):
    data = bytearray()
    for i in range(int(rate * seconds)):
        t = i / rate
        value = max(-1, min(1, sample(t, seconds)))
        data.extend(struct.pack('<h', int(value * 22000)))
    with wave.open(str(out / (name + '.wav')), 'wb') as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(rate); f.writeframes(data)
save('engine', 1, lambda t,d: .45*math.sin(2*math.pi*70*t)+.22*math.sin(2*math.pi*140*t)+.13*math.sin(2*math.pi*210*t))
save('wind', 1, lambda t,d: random.uniform(-.22,.22) * math.sin(math.pi*t/d)**.3)
save('swing', .2, lambda t,d: random.uniform(-.5,.5)*math.sin(math.pi*t/d))
save('hit', .23, lambda t,d: (random.uniform(-.5,.5)+.5*math.sin(2*math.pi*100*t))*math.exp(-22*t))
save('crash', .65, lambda t,d: random.uniform(-.9,.9)*math.exp(-6*t))
save('countdown', .16, lambda t,d: .45*math.sin(2*math.pi*660*t)*min(1,t*100)*math.exp(-12*t))
save('finish', .8, lambda t,d: .35*math.sin(2*math.pi*[523,659,784,1046][min(3,int(t*5))]*t)*min(1,t*50)*min(1,(d-t)*15))

save('siren', 2, lambda t,d: .45*math.sin(2*math.pi*650*t - 200*math.cos(2*math.pi*t)/1))
