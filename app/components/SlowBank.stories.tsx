import React from 'react'
import AppUI, { AppUIProps } from './AppUI'
import { Operation } from '../lib/model'

const initialOpen: Operation[] = [
  { id: 1, type: 'insert', tx: 0,  vs: 0,  ve: Number.POSITIVE_INFINITY, value: 'balance=100' },
]

const after20Chained: Operation[] = [
  ...initialOpen,
  { id: 2, type: 'deactivate',  tx: 20, vs: 0,  ve: Number.POSITIVE_INFINITY },
  { id: 3, type: 'insert', tx: 20, vs: 0,  ve: 20, value: 'balance=100' },
  { id: 4, type: 'insert', tx: 20, vs: 20, ve: Number.POSITIVE_INFINITY, value: 'balance=300' },
]

const after25Chained: Operation[] = [
  ...after20Chained,
  { id: 5, type: 'deactivate',  tx: 25, vs: 0,  ve: Number.POSITIVE_INFINITY },
  { id: 6, type: 'insert', tx: 25, vs: 0,  ve: 17, value: 'balance=100' },
  { id: 7, type: 'insert', tx: 25, vs: 17, ve: 20, value: 'balance=150' },
  { id: 8, type: 'insert', tx: 25, vs: 20, ve: Number.POSITIVE_INFINITY, value: 'balance=350' },
]

export default {
  title: 'Scenarios/SlowBank',
  component: AppUI,
  parameters: { layout: 'fullscreen' },
}

const Template = (args: AppUIProps) => React.createElement(AppUI, { ...args })

export const Tx0_Opening = Template.bind({}) as any
Tx0_Opening.args = {
  initialOps: initialOpen,
  initialAsOf: 0,
  initialGridMaxTx: 30,
  initialGridMaxValid: 30,
  initialReplayCount: initialOpen.length,
  initialShowHistorical: false,
} satisfies AppUIProps

export const Tx20_PreBackdated = Template.bind({}) as any
Tx20_PreBackdated.args = {
  initialOps: after20Chained,
  initialAsOf: 20,
  initialGridMaxTx: 30,
  initialGridMaxValid: 30,
  initialReplayCount: after20Chained.length,
  initialShowHistorical: false,
} as AppUIProps

export const Tx25_PostBackdated = Template.bind({}) as any
Tx25_PostBackdated.args = {
  initialOps: after25Chained,
  initialAsOf: 25,
  initialGridMaxTx: 30,
  initialGridMaxValid: 30,
  initialReplayCount: after25Chained.length,
  initialShowHistorical: false,
} as AppUIProps
