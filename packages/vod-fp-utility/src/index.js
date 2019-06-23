import * as oop from './oop';
import {
  F,
  Maybe,
  Just,
  Empty,
  Fail,
  Success,
  either,
  eitherToMaybe,
  maybe,
  maybeToEither,
  emptyToResolve,
  Task,
  Tick,
  CusError
} from './fp';
import Logger from './logger';

const {
  EventBus,
  PipeLine,
  StateMachine,
  combineActions,
  combineStates,
  createStore
} = oop;

export {
  F,
  Maybe,
  Just,
  Empty,
  Fail,
  Success,
  either,
  eitherToMaybe,
  maybe,
  maybeToEither,
  emptyToResolve,
  Task,
  EventBus,
  PipeLine,
  StateMachine,
  Tick,
  CusError,
  combineActions,
  combineStates,
  createStore,
  Logger
};
