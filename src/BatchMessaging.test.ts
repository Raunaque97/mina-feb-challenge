import { BatchMessaging } from './BatchMessaging';
import {
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  UInt64,
  Reducer,
} from 'o1js';

/*
 */

let proofsEnabled = false;

describe('BatchMessaging', () => {
  let feePayerAccount: PublicKey,
    feePayerkey: PrivateKey,
    zkAppAccount: PublicKey,
    zkAppKey: PrivateKey,
    zkApp: BatchMessaging;

  beforeAll(async () => {
    const analysis = BatchMessaging.analyzeMethods();
    // print analysis.postMessage.rows and analysis.process.rows
    console.log('postMessage rows', analysis.postMessage.rows);
    console.log('processMessage rows', analysis.processMessage.rows);

    if (proofsEnabled) await BatchMessaging.compile();
  });

  beforeEach(() => {
    const Local = Mina.LocalBlockchain({ proofsEnabled });
    Mina.setActiveInstance(Local);
    ({ privateKey: feePayerkey, publicKey: feePayerAccount } =
      Local.testAccounts[0]);

    zkAppKey = PrivateKey.random();
    zkAppAccount = zkAppKey.toPublicKey();
    zkApp = new BatchMessaging(zkAppAccount);
  });

  async function localDeploy() {
    const txn = await Mina.transaction(feePayerAccount, () => {
      AccountUpdate.fundNewAccount(feePayerAccount);
      zkApp.deploy();
      zkApp.actionState.set(Reducer.initialActionState);
    });
    await txn.prove();
    await txn.sign([feePayerkey, zkAppKey]).send();
  }

  it('deploy', async () => {
    await localDeploy();
  });

  it('post message', async () => {
    await localDeploy();

    const txn = await Mina.transaction(feePayerAccount, () => {
      zkApp.postMessage(
        UInt64.from(10),
        UInt64.from(1),
        UInt64.from(1000),
        UInt64.from(5000),
        UInt64.from(6001)
      );
    });
    await txn.prove();
    await txn.sign([feePayerkey]).send();
  });

  it('should fail for wrong checkSum', async () => {
    await localDeploy();
    expect(
      Mina.transaction(feePayerAccount, () => {
        zkApp.postMessage(
          UInt64.from(10),
          UInt64.from(1),
          UInt64.from(1000),
          UInt64.from(5000),
          UInt64.from(6003)
        );
      })
    ).rejects.toThrow('message not valid');
  });

  it('should fail for wrong Message details', async () => {
    await localDeploy();
    expect(
      Mina.transaction(feePayerAccount, () => {
        zkApp.postMessage(
          UInt64.from(10),
          UInt64.from(1),
          UInt64.from(5000),
          UInt64.from(1000),
          UInt64.from(6001)
        );
      })
    ).rejects.toThrow('message not valid');
  });

  it('should post message for agent 0 even for wrong Message details', async () => {
    await localDeploy();
    const txn = await Mina.transaction(feePayerAccount, () => {
      zkApp.postMessage(
        UInt64.from(10),
        UInt64.from(0),
        UInt64.from(5000),
        UInt64.from(1000),
        UInt64.from(0)
      );
    });
    await txn.prove();
    await txn.sign([feePayerkey]).send();
  });

  it('should be able to process message', async () => {
    await localDeploy();
    // post 100 messages
    for (let i = 0; i < 100; i++) {
      const txn = await Mina.transaction(feePayerAccount, () => {
        zkApp.postMessage(
          UInt64.from(50 - Math.abs(i - 50)),
          UInt64.from(i),
          UInt64.from(1000),
          UInt64.from(5000),
          UInt64.from(6000 + i)
        );
      });
      await txn.prove();
      await txn.sign([feePayerkey]).send();
    }

    const txn = await Mina.transaction(feePayerAccount, () => {
      zkApp.processMessage();
    });
    await txn.prove();
    await txn.sign([feePayerkey]).send();

    expect(zkApp.highestMsgNum.get().toBigInt()).toBe(50n);
  });
});
