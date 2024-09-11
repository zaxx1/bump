const { delay } = require('../modules/core');
const fs = require('fs');
const path = require('path');
const colors = require('colors');
const { parse } = require('querystring');
const readline = require('readline');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

const RETRY_REQUEST = 5;

const headers = {
  authority: 'api.mmbump.pro',
  'Content-Type': 'application/json',
  Host: 'https://mmbump.pro',
  Origin: 'https://mmbump.pro',
  Referer: 'https://mmbump.pro/',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': 'Windows',
  'Sec-Fetch-Dest': ' empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-site',
  priority:'u=1, i',
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
};
const mapAuth = new Map();
const timeClaim = new Map();

async function getHeader(username, customHeader) {
  const data =  await getDataMapAuth(username);
  return {
    ...headers,
    Authorization: 'Bearer ' + data?.token,
    ...customHeader,
    user_auth: data?.extUserId,
  };
}
const formatNumber = (point = 0) => {
  return new Intl.NumberFormat('us-US').format(point);
};
async function setDataMapAuth(username, data) {
  mapAuth.set(username, data);
}
async function setDataMapTime(username, data) {
  timeClaim.set(username, data);
}

function getDataMapTime(username) {
  return timeClaim.set(username, data);
}
async function getDataMapAuth(username) {
  const data = await mapAuth.get(username);
  return data
}
function errors(username, message) {
  console.log(colors.red(`[ Error ]`), colors.red(message));
}
function logs(username, message, other) {
  console.log(
    colors.magenta(`[ ${username} ]`),
    colors.green(message),
    other ? other : '',
  );
}
function toLocalTime(time, addHour,type) {
  if(type === 'unix'){
    return dayjs.unix(time).add(addHour ? addHour : 0, 'hour').unix()
  }
  return dayjs.unix(time).add(addHour ? addHour : 0, 'hour').tz('Asia/Ho_Chi_Minh').format('DD/MM/YYYY HH:mm');
}

async function processAccount(username) {
  console.log();
  console.log(
    '-------- Account : ',
    colors.green(username),
    ' running --------',
  );

  const isAuth = await login(username);
  if(!isAuth) return
  const status = await statusFarming(username, {
    showBalance: true,
    showBoots: true,
    showStatus: true,
    showTime: true,
    showWallet: true,
  });
  await doQuest(username);
  await friendClaim(username);
  if (status === 'await') {
    await retryStartFarm(username);
    await statusFarming(username, {
      showBalance: true,
      showTime: true,
    });
  } else {
    const isClaim = await statusFarming(username);
    if (!isClaim) return;
    await retryClaim(username);
    delay(2, true);
    await retryStartFarm(username);
    await statusFarming(username, {
      showBalance: true,
      showTime: true,
    });
  }
}

const login = async (username) => {
  const user = await getDataMapAuth(username);
  const headers = await getHeader(username, {
    path: '/v1/loginJwt',
  })
  const res = await fetch('https://api.mmbump.pro/v1/loginJwt', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      initData: user?.query_id,
    }),
  });
  const response = await res.json();

  const { code, access_token } = response;

  if(code === 401){
    return
  }

  if (access_token) {
    logs(username, '', colors.yellow('Login thành công !'));
    await setDataMapAuth(username, {
      ...user,
      token: access_token,
    });
    return true
  } else {
    errors(username, 'Login thất bại !');
    return
  }
};

const statusFarming = async (username, showData) => {
  try {
    const headers = await getHeader(username, {
      path: '/v1/farming',
    })
    const res = await fetch('https://api.mmbump.pro/v1/farming', {
      method: 'POST',
      headers: headers,
    });
    const response = await res.json();
    const {
      wallet,
      balance,
      session: { status, start_at },
      info: { boost, active_booster_finish_at },
    } = response;

    const timeStempClaim = toLocalTime(start_at,6,'unix')
    const currentTime = Date.now() / 1000;
    const timeClaim = toLocalTime(timeStempClaim)

    await setDataMapTime(username, timeStempClaim);

    if (!showData) {
      return timeStempClaim - currentTime <= 0;
    }

    const { showBalance, showBoots, showStatus, showTime, showWallet } =
      showData;


    if(showWallet){
      logs(
        username,
        'Địa chỉ ví:',
        wallet ? colors.yellow(wallet) : colors.red('Chưa bind địa chỉ ví !'),
      );
    }

    if(showBalance){
      logs(username, 'Balance:', colors.yellow(formatNumber(balance)));
    }

    if(showBoots){
      if (boost) {
        logs(
          username,
          `Đang active boots: ${boost}`,
          colors.cyan(`Active tới ngày ${toLocalTime(active_booster_finish_at)}`),
        );
      } else {
        logs(username, 'Tự động mua boots x5 ...');
        await buybootX5(username);
      }
    }

    if(showStatus){
      logs(username, 'Status:', colors.yellow(status));
    }

    if(showTime){
      logs(username, 'Thời gian claim:', colors.yellow(timeClaim));
    }
    
    return status;
  } catch (error) {
    errors(username, error);
  }
};

const startFarm = async (username) => {
  try {
    const headers = await getHeader(username, {
      path: '/v1/farming/start',
    })
    const res = await fetch('https://api.mmbump.pro/v1/farming/start', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        status: 'inProgress',
        hash: '9129340eb103c1d43b157c0b9e9ad5e33e68a68e1b12b6e2542eca8702eeada8',
      }),
    });
    logs(username, 'Start farming thành công !');
    const response = await res.json();
    const { status } = response
    if(status === 200){
      logs(username, 'Farm thành công !');
    } else {
      errors('Farm lỗi !')
    }
  } catch (error) {
    errors(username, error);
  }
};

const retryStartFarm = async (username) => {
  let retryCount = 1;
  try {
    await startFarm(username);
  } catch (error) {
    errors(
      username,
      'Start farm error !',
      colors.yellow(`Start lại sau mỗi 2s, lần claim thứ ${retryCount}`),
    );
    delay(2, true);
    if (retryCount <= RETRY_REQUEST) {
      ++retryCount;
      await startFarm(username);
    }
  }
};

const retryClaim = async (username) => {
  let retryCount = 1;
  try {
    await claiming(username);
  } catch (error) {
    errors(
      username,
      'Claim error !',
      colors.yellow(`Claim lại sau mỗi 2s, lần claim thứ ${retryCount}`),
    );
    delay(2, true);
    if (retryCount <= RETRY_REQUEST) {
      ++retryCount;
      await claiming(username);
    }
  }
};

const randomTapCount = (username) => {
  if (username === 'uchihaObitoAntiSenju') {
    return Math.floor(Math.random() * (20000000 - 15000000 + 1)) + 15000000;
  } else return Math.floor(Math.random() * (10000000 - 5000000 + 1)) + 50000000;
};

const claiming = async (username) => {
  try {
    const headers = await getHeader(username, {
      path: '/v1/farming/finish',
    })
    const res = await fetch('https://api.mmbump.pro/v1/farming/finish', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        tapCount: randomTapCount(username),
        hash: '9129340eb103c1d43b157c0b9e9ad5e33e68a68e1b12b6e2542eca8702eeada8',
      }),
    });
    const response = await res.json();
    const { statusCode } = response
    if(statusCode === 200){
      logs(username, 'Claim thành công !');
    } else {
      errors('Claim lỗi !')
    }

  } catch (error) {
    errors(username, error);
  }
};

const buybootX5 = async (username) => {
  try {
    const headers = await getHeader(username, {
      path: '/v1/farming/finish',
    })
    const res = await fetch('https://api.mmbump.pro/v1/product-list/buy', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        id: 'x5',
        hash: '0c548c79a2956406a9c74de7594f130aba57edbfc666482dbe0b89b2cc0a40fb',
      }),
    });
    const response = await res.json();
    const { finish_at, id } = response;
    if (finish_at) {
      logs(username, `Mua boots ${id} thành công !`, colors.red(' 😎😎😎 '));
    }
  } catch (error) {
    errors(username, error);
  }
};

const doQuest = async (username) => {
  const headers = await getHeader(username, {
    path: '/v1/task-list',
  })
  const res = await fetch('https://api.mmbump.pro/v1/task-list', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      hash: '9e26bdb7141db659a97afaa38ca4fb35f75a54e2e6b08c5d4f60be252d2c7122',
    }),
  });
  const response = await res.json();
  const questUnComplete = [...response].filter(
    (e) => e?.status === 'possible' && e?.is_active && ![9,10].includes(e?.id),
  );
  


  if (!questUnComplete.length) {
    logs(username, 'Đã hoàn thành tất cả các quest !');
    return;
  }
  
  const listQuestTele = questUnComplete.filter((e) => [2,3,8,24].includes(e?.id))
  const listQuestNotTele = questUnComplete.filter((e) => ![2,3,8,24].includes(e?.id))

  if(listQuestTele.length){
    logs(username, '',colors.red('Còn quest telegram chưa làm !!!'));
  }

  for await (const quest of listQuestNotTele) {
    const { name, id } = quest;
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(
      `[ ${colors.magenta(`${username}`)} ]` +
        colors.yellow(` Quest : ${colors.white(name)} `) +
        colors.red('Đang làm... '),
    );
    await delay(2, true);
    const isFinish = await completeQuest(username, id);
    readline.cursorTo(process.stdout, 0);
    if (isFinish) {
      process.stdout.write(
        `[ ${colors.magenta(`${username}`)} ]` +
          colors.yellow(` Quest : ${colors.white(name)} `) +
          colors.green('Done !                  '),
      );
    } else {
      process.stdout.write(
        `[ ${colors.magenta(`${username}`)} ]` +
          colors.yellow(` Quest : ${colors.white(name)} `) +
          colors.red('Faild !                  '),
      );
    }
    console.log();
  }
};

const completeQuest = async (username, id) => {
  const headers = await getHeader(username, {
    path: '/v1/task-list/complete',
  })

  const res = await fetch('https://api.mmbump.pro/v1/task-list/complete', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      hash: 'ef0952a6c1ce0575bf906c2fe44e61b141241c05fa97fa405905a88e5bb39e44',
      id: id,
    }),
  });
  const response = await res.json();
  const {
    balance,
    task: { status },
  } = response;
  return status === 'granted';
};

const friendCheck = async (username) => {
  try {
    const headers = await getHeader(username, {
      path: '/v1/friends',
      method:'POST'
    })
    const res = await fetch('https://api.mmbump.pro/v1/friends', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        hash: '9e26bdb7141db659a97afaa38ca4fb35f75a54e2e6b08c5d4f60be252d2c7122',
      }),
    });
    
    const response = await res.json()
  
    if(!response){
      errors(username,'Error FriendCheck !')
      return
    }
  
    const { friend_claim } = response;
    if (!!friend_claim) {
      const balance = await friendClaim(username);
      logs(username, 'Claim từ bạn bè:', colors.yellow(formatNumber(balance)));
    }
  } catch (error) {
    console.log(error);
    
  }
};

const friendClaim = async (username) => {
  try {
    const headers = await getHeader(username, {
      path: '/v1/friends/claim',
    })
  
    const res = await fetch('https://api.mmbump.pro/v1/friends/claim', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        hash: '34e0c7980257618e891ca2b6695bd9be719e73fe8ae74981f76b1053cff5ae8b',
      }),
    });
    const response = await res.json();
    const { code, balance } = response;
    if(code === 400){
      errors(username,'Claim point bạn bè lỗi !')
    } else {
      logs(username,'Claim bạn bè thành công !', colors.cyan(`Balance: ${formatNumber(balance)}`))
    }
    return balance;
  } catch (error) {
    errors(username, error);
  }
};

async function loadProfile() {
  const dataFile = path.join(__dirname, 'data.txt');
  const v = fs
    .readFileSync(dataFile, 'utf8')
    .replace(/\r/g, '')
    .split('\n')
    .filter(Boolean);

  if (v.length) {
    for await (let a of v) {
      const data = await extractUserData(a);
      await setDataMapAuth(data?.extUserName, {
        ...data,
        query_id: a,
      });
    }
    console.log(
      colors.green(`Load thành công ${colors.white(v.length)} profile`),
    );
    return v;
  }
  console.log(colors.red('Không tìm thấy thông tin nào trong data.txt'));
  return [];
}

const extractUserData = async (queryId) => {
  const decodedString = decodeURIComponent(queryId);
  const params = new URLSearchParams(decodedString);
  const user = JSON.parse(params.get('user'));
  return {
    extUserId: user.id,
    extUserName: user.username,
  };
};

async function waitWithCountdown(seconds) {
  console.log();
  for (let i = seconds; i >= 0; i--) {
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(
      `===== Đã hoàn thành tất cả tài khoản, chờ ${i} giây để tiếp tục vòng lặp =====`,
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  console.log('');
}

const getTimeClaimMin = async () => {
  const keyValue = Array.from(timeClaim, ([k, v]) => ({ k, v }));
  if(!keyValue.length){
    errors('','Chưa tài khoản nào login !')
    return
  }
  const nearest = Math.min(...Object.values(keyValue.map((i) => i.v)));
  const data = keyValue.find((i) => i.v === nearest);
  console.log(
    colors.red(
      `======== Tiếp theo ${colors.green(
        data.k,
      )} thời gian claim : ${colors.cyan(toLocalTime(nearest))}`,
    ),
  );
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const secondsUntilTarget = nearest - currentTimestamp;
  return secondsUntilTarget;
};

async function eventLoop() {
  for await (const username of mapAuth.keys()) {
    await processAccount(username);
    await delay(1, true);
  }
  const timeClaim = await getTimeClaimMin();
  if(timeClaim){
    await waitWithCountdown(timeClaim);
    await eventLoop();
  }
}

(async function main() {
  await loadProfile();
  await delay(1, true);
  await eventLoop();
})();
