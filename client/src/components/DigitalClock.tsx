import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export function DigitalClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white/50 backdrop-blur-sm rounded-3xl border border-white/40 shadow-xl shadow-primary/5">
      <div className="font-mono text-5xl md:text-6xl font-bold tracking-wider text-foreground tabular-nums">
        {time.toLocaleTimeString('en-US', { 
          hour12: false, 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        })}
      </div>
      <div className="text-muted-foreground mt-2 font-medium">
        {format(time, "EEEE, d MMM yyyy", { locale: id })}
      </div>
    </div>
  );
}
