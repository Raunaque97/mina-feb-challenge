import {
  Field,
  SmartContract,
  state,
  State,
  method,
  UInt64,
  Reducer,
  Provable,
} from 'o1js';

/**
 *
 */
export class BatchMessaging extends SmartContract {
  @state(UInt64) highestMsgNum = State<UInt64>();
  @state(Field) actionState = State<Field>();

  reducer = Reducer({ actionType: UInt64 });

  init() {
    super.init();
    this.highestMsgNum.set(UInt64.from(0));
  }

  @method processMessage() {
    const highestMsgNum = this.highestMsgNum.getAndRequireEquals();
    const oldActionState = this.actionState.getAndRequireEquals();

    const pendingActions = this.reducer.getActions({
      fromActionState: oldActionState,
    });
    const { state: newHighestMsgNum, actionState: newActionState } =
      this.reducer.reduce(
        pendingActions,
        UInt64,
        (state: UInt64, action: UInt64) => {
          return Provable.if(state.greaterThan(action), state, action);
        },
        {
          state: highestMsgNum,
          actionState: oldActionState,
        },
        {
          maxTransactionsWithActions: 200,
        }
      );
    this.highestMsgNum.set(newHighestMsgNum);
    this.actionState.set(newActionState);
  }

  @method postMessage(
    messageNum: UInt64,
    agentID: UInt64,
    agentXloc: UInt64,
    agentYloc: UInt64,
    checkSum: UInt64
  ) {
    let conditions;
    // CheckSum is the sum of Agent ID , Agent XLocation and Agent YLocation
    conditions = checkSum.equals(agentID.add(agentXloc).add(agentYloc));

    // Agent ID (should be between 0 and 3000)
    conditions = conditions.and(agentID.lessThanOrEqual(UInt64.from(3000)));

    // Agent XLocation (should be between 0 and 15000)
    conditions = conditions.and(agentXloc.lessThanOrEqual(UInt64.from(15000)));

    // Agent YLocation (should be between 5000 and 20000)
    conditions = conditions.and(
      agentYloc.greaterThanOrEqual(UInt64.from(5000))
    );
    conditions = conditions.and(agentYloc.lessThanOrEqual(UInt64.from(20000)));

    // Agent YLocation should be greater than Agent XLocation
    conditions = conditions.and(agentYloc.greaterThan(agentXloc));

    agentID.equals(UInt64.zero).or(conditions).assertTrue('message not valid');
    // dispatch action
    this.reducer.dispatch(messageNum);
  }
}
