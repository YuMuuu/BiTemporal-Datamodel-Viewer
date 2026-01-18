import React from 'react'
import AppUI, { AppUIProps } from './AppUI'
import { Operation } from '../lib/model'

// Blog: https://matsu-chara.hatenablog.com/entry/2017/04/01/110000
// Example used: John hired at t=1 (PRG, 2000); salary raised to 3000 at valid=3 but recorded at tx=4; job changed to DBA at t=6.

// Step1 (tx=1): hire PRG 2000 at valid=[1,∞)
const step1: Operation[] = [
  { id: 1, type: 'insert', tx: 1, vs: 1, ve: Number.POSITIVE_INFINITY, value: 'job=PRG, salary=2000' },
]

// Step2 (tx=4): raise salary to 3000 from valid=3 (back-dated)
const step2: Operation[] = [
  ...step1,
  { id: 2, type: 'deactivate', tx: 4, vs: 3, ve: Number.POSITIVE_INFINITY },
  { id: 3, type: 'insert',     tx: 4, vs: 3, ve: Number.POSITIVE_INFINITY, value: 'job=PRG, salary=3000' },
]

// Step3 (tx=6): change job to DBA from valid=6
const step3: Operation[] = [
  ...step2,
  { id: 4, type: 'deactivate', tx: 6, vs: 6, ve: Number.POSITIVE_INFINITY },
  { id: 5, type: 'insert',     tx: 6, vs: 6, ve: Number.POSITIVE_INFINITY, value: 'job=DBA, salary=3000' },
]

export default {
  title: 'Scenarios/MatsuCharaBlog',
  component: AppUI,
  parameters: { layout: 'fullscreen' },
}

const Template = (args: AppUIProps) => React.createElement(AppUI, { ...args })

export const Step1_Tx1 = Template.bind({}) as any
Step1_Tx1.args = {
  initialOps: step1,
  initialAsOf: 1,
  initialGridMaxTx: 8,
  initialGridMaxValid: 8,
  initialReplayCount: step1.length,
  initialShowHistorical: false,
} satisfies AppUIProps

export const Step2_Tx4 = Template.bind({}) as any
Step2_Tx4.args = {
  initialOps: step2,
  initialAsOf: 4,
  initialGridMaxTx: 8,
  initialGridMaxValid: 8,
  initialReplayCount: step2.length,
  initialShowHistorical: false,
} as AppUIProps

export const Step3_Tx6 = Template.bind({}) as any
Step3_Tx6.args = {
  initialOps: step3,
  initialAsOf: 6,
  initialGridMaxTx: 8,
  initialGridMaxValid: 8,
  initialReplayCount: step3.length,
  initialShowHistorical: false,
} as AppUIProps

