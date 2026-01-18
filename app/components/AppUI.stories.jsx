import React from 'react'
import AppUI from './AppUI.jsx'

const sampleOps = [
  { id: 1, type: 'upsert', tx: 0, vs: 0, ve: Number.POSITIVE_INFINITY, value: 'a' },
  { id: 2, type: 'upsert', tx: 2, vs: 2, ve: Number.POSITIVE_INFINITY, value: 'b' },
]

export default {
  title: 'App/AppUI',
  component: AppUI,
  parameters: { layout: 'fullscreen' },
}

const Template = (args) => React.createElement(AppUI, { ...args })

export const ASOF_0 = Template.bind({})
ASOF_0.args = {
  initialOps: sampleOps,
  initialAsOf: 0,
  initialGridMaxTx: 5,
  initialGridMaxValid: 5,
  initialReplayCount: sampleOps.length,
  initialShowHistorical: false,
}

export const ASOF_2 = Template.bind({})
ASOF_2.args = { ...ASOF_0.args, initialAsOf: 2, initialShowHistorical: false }

export const Replay_1 = Template.bind({})
Replay_1.args = { ...ASOF_0.args, initialAsOf: 2, initialReplayCount: 1, initialShowHistorical: false }
