import React from 'react';

import { ComingSoon } from '@/components/home/ComingSoon';
import { ShieldCheckmark } from '@/components/icons';
import { UI } from '@/components/market/tokens';
import { sp } from '@/utils/responsive';

/** Checks tab – placeholder only; the feature will be specified later. */
export default function ChecksScreen() {
  return (
    <ComingSoon
      title="Checks"
      heading="Checks is on its way"
      text="This section will be available soon."
      icon={<ShieldCheckmark size={sp(26)} color={UI.blue} />}
    />
  );
}
