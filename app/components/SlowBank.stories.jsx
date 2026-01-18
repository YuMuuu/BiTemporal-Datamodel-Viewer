import React from 'react'
import AppUI from './AppUI.jsx'

// Time index (integer days)
// 0 = 1/01, 17 = 1/18 (for [start,end) semantics, we use 17 for 1/17 start),
// 20 = 1/21 (illustrative). We keep integers to match the viewer model.

const initialOpen = [
  { id: 1, type: 'upsert', tx: 0,  vs: 0,  ve: Number.POSITIVE_INFINITY, value: '100' }, // open at 100
]

// Chain step at tx=20: close old worldview, insert two rows for business time
const after20Chained = [
  ...initialOpen,
  { id: 2, type: 'close',  tx: 20, vs: 0,  ve: Number.POSITIVE_INFINITY },       // invalidate all prior open rows at tx=20
  { id: 3, type: 'upsert', tx: 20, vs: 0,  ve: 20, value: '100' },                // 0–20 stays 100
  { id: 4, type: 'upsert', tx: 20, vs: 20, ve: Number.POSITIVE_INFINITY, value: '300' }, // 20–∞ becomes 300
]

// Chain step at tx=25: close rows created at tx=20, then insert corrected splits
const after25Chained = [
  ...after20Chained,
  { id: 5, type: 'close',  tx: 25, vs: 0,  ve: Number.POSITIVE_INFINITY },       // invalidate tx=20 worldview
  { id: 6, type: 'upsert', tx: 25, vs: 0,  ve: 17, value: '100' },                // 0–17 stays 100
  { id: 7, type: 'upsert', tx: 25, vs: 17, ve: 20, value: '150' },                // 17–20 becomes 150
  { id: 8, type: 'upsert', tx: 25, vs: 20, ve: Number.POSITIVE_INFINITY, value: '350' }, // 20–∞ becomes 350
]

export default {
  title: 'Scenarios/SlowBank',
  component: AppUI,
  parameters: { layout: 'fullscreen' },
}

const Template = (args) => React.createElement(AppUI, { ...args })

// 1) Opening balance only
export const Tx0_Opening = Template.bind({})
Tx0_Opening.args = {
  initialOps: initialOpen,
  initialAsOf: 0,
  initialGridMaxTx: 30,
  initialGridMaxValid: 30,
  initialReplayCount: initialOpen.length,
  initialShowHistorical: false,
}

// 2) After $200 recorded at tx=20 (no backdated yet)
export const Tx20_PreBackdated = Template.bind({})
Tx20_PreBackdated.args = {
  initialOps: after20Chained,
  initialAsOf: 20,
  initialGridMaxTx: 30,
  initialGridMaxValid: 30,
  initialReplayCount: after20Chained.length,
  initialShowHistorical: false,
}

// 3) After backdated $50 (valid=17) recorded at tx=25
export const Tx25_PostBackdated = Template.bind({})
Tx25_PostBackdated.args = {
  initialOps: after25Chained,
  initialAsOf: 25,
  initialGridMaxTx: 30,
  initialGridMaxValid: 30,
  initialReplayCount: after25Chained.length,
  initialShowHistorical: false,
}
