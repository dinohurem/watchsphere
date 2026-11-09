import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

let cached = false;

/** True when the user has "Reduce Motion" switched on – animations then show the end state. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(cached);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        cached = value;
        if (mounted) setReduce(value);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      cached = value;
      setReduce(value);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduce;
}
