import React from 'react';

import { ComingSoon } from '@/components/home/ComingSoon';
import { TradeArrows } from '@/components/icons';
import { UI } from '@/components/market/tokens';
import { sp } from '@/utils/responsive';

/** T1 – Trade (formerly Inventory): coming-soon placeholder only. */
export default function TradeScreen() {
  return (
    <ComingSoon
      title="Trade"
      heading="Trade is on its way"
      text="Soon you can close deals directly in the app."
      icon={<TradeArrows size={sp(26)} color={UI.blue} />}
    />
  );
}
