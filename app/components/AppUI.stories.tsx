import React from 'react'
import AppUI, { AppUIProps } from './AppUI'
import { Operation } from '../lib/model'

const sampleOps: Operation[] = [
  { id: 1, type: 'insert', tx: 0, vs: 0, ve: Number.POSITIVE_INFINITY, value: 'a' },
  { id: 2, type: 'insert', tx: 2, vs: 2, ve: Number.POSITIVE_INFINITY, value: 'b' },
]

export default {
  title: 'App/AppUI',
  component: AppUI,
  parameters: { layout: 'fullscreen' },
}

const Template = (args: AppUIProps) => React.createElement(AppUI, { ...args })

export const ASOF_0 = Template.bind({}) as any
ASOF_0.args = {
  initialOps: sampleOps,
  initialAsOf: 0,
  initialGridMaxTx: 5,
  initialGridMaxValid: 5,
  initialReplayCount: sampleOps.length,
  initialShowHistorical: false,
} satisfies AppUIProps

export const ASOF_2 = Template.bind({}) as any
ASOF_2.args = { ...ASOF_0.args, initialAsOf: 2 } as AppUIProps

export const Replay_1 = Template.bind({}) as any
Replay_1.args = { ...ASOF_0.args, initialAsOf: 2, initialReplayCount: 1 } as AppUIProps
