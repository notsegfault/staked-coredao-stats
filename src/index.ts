import { BigNumber, ethers } from 'ethers';
import { EOL } from 'os';
import fs from 'fs';
import { assert } from 'console';

const RPC_URL = "https://eth-mainnet.alchemyapi.io/v2/TsLEJAhX87icgMO7ZVyPcpeEgpFEo96O";
const VAULT_ADDRESS = "0xC5cacb708425961594B63eC171f4df27a9c0d8c9";

const DEPOSIT = ethers.utils.id('Deposit(address,uint256,uint256)');
const WITHDRAW = ethers.utils.id('Withdraw(address,uint256,uint256)');
const PID = "3";

console.log(`Using RPC ${RPC_URL}`);
console.log(`Contract Address ${VAULT_ADDRESS}`);

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const decoder = new ethers.utils.AbiCoder();

const main = async () => {
  const toBlock = await provider.getBlockNumber();
  const fromBlock = 14147136; // Block when the coredao pool was added
  console.log(`From Block ${fromBlock} to ${toBlock}`);

  const topics = [
    DEPOSIT,
    WITHDRAW
  ];

  let transactions: any[] = [];
  const userStakedBalance: any = {};

  console.log(`Reading events...`);
  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    const logs = (await provider.getLogs({
      address: VAULT_ADDRESS,
      topics: [topic],
      fromBlock,
      toBlock,
    })).filter((l) => !l.removed);

    transactions = [...transactions, ...logs];
  }

  transactions.sort((a, b) => (a.blocknumber < b.blocknumber) ? -1 : 1)

  for (let i = 0; i < transactions.length; i++) {
    const transaction = transactions[i];

    const topic = ethers.utils.hexStripZeros(transaction.topics[0]);
    const account: string = decoder.decode(["address"], transaction.topics[1])[0];
    const pid: string = decoder.decode(["uint256"], transaction.topics[2])[0].toString();
    const amount: BigNumber = decoder.decode(["uint256"], transaction.data)[0];

    //console.log(account, pid, amount);
    if (pid != PID) continue;

    if (!userStakedBalance[account]) {
      userStakedBalance[account] = BigNumber.from(0);
    }

    switch (topic) {
      case DEPOSIT:
        //console.log(`Depositing ${amount.toString()}...`);
        userStakedBalance[account] = userStakedBalance[account].add(amount);
        break;
      case WITHDRAW:
        //console.log(`Withdrawing ${amount.toString()}...`);
        userStakedBalance[account] = userStakedBalance[account].sub(amount);
        break;
    }
  }

  let content = "";
  Object.keys(userStakedBalance).forEach(account => {
    const amount = userStakedBalance[account];
    assert(amount.gte(0));

    if (amount.gt(0)) {
      content += `_balances[${ethers.utils.getAddress(account)}] = ${amount.toString()};${EOL}`;
    }
    //console.log(account, amount.toString());
  })

  fs.writeFile('data/entries.sol', content, { flag: 'w+' }, err => { })
};

main();
