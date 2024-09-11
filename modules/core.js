const fs = require("fs");
const path = require("path");

const profile = new Map();
const time = new Map();
const state = new Map();

const STRING = {
  dailyCryproRank: "daily-crypto",
  dailyDormint: "daily-dormint",
  dailyMatch: "daily-match",
};

function getRandomRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function loadConfig(url) {
  const datas = fs
    .readFileSync(url, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) => line.length > 0 && decodeURIComponent(line).includes("user=")
    );

  if (datas.length <= 0) {
    console.log(colors.red(`Không tìm thấy dữ liệu`));
    process.exit();
  }
  return datas;
}

async function loadConfigDecode(url) {
  const datas = fs
    .readFileSync(url, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) => line.length > 0 && decodeURIComponent(line).includes("user=")
    );

  if (datas.length <= 0) {
    console.log(colors.red(`Không tìm thấy dữ liệu`));
    process.exit();
  }
  return datas.map((line) => decodeURIComponent(line));
}


async function delay(second, hidden) {
  !hidden && innerLog("delay", second, "seconds");
  return new Promise((ok) => setTimeout(ok, second > 0 ? second * 1000 : 100));
}

function setTime(username, project, input) {
  const key = `${username}$${project}`;
  if (time.has(key)) {
    time.delete(key);
  }

  if (input === 0) {
    time.set(key, input)
    return;
  }

  // Claim after 2p
  time.set(key, input + 2 * 60 * 1000);
}

function innerLog(project, text, ex) {
  console.log(`[${project.toUpperCase()}] ${text || ""} ${ex || ""}`);
}

function profileSumary() {
  profile.forEach((v, k) => {
    let key = k;

    console.log("[", key, "]", v.length, "profiles");
  });
}

function milisecondToRemainTime(ms) {
  let seconds = (ms / 1000).toFixed(1);
  let minutes = (ms / (1000 * 60)).toFixed(1);
  let hours = (ms / (1000 * 60 * 60)).toFixed(1);
  let days = (ms / (1000 * 60 * 60 * 24)).toFixed(1);
  if (seconds < 60) return seconds + " s";
  else if (minutes < 60) return minutes + " p";
  else if (hours < 24) return hours + " h";
  else return days + " Days";
}

const rPath = (f) => path.join(__dirname, f);

function timestampToUTC(timestamp, withoutTime) {
  if (timestamp <= 0) return "NOW";
  const currentDate = new Date(timestamp);
  const day = currentDate.getDate();
  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();
  const hours = currentDate.getHours();
  const minutes = currentDate.getMinutes();
  const seconds = currentDate.getSeconds();
  const paddedDay = String(day).padStart(2, "0");
  const paddedMonth = String(month).padStart(2, "0");
  const paddedYear = String(year).padStart(4, "0");
  const paddedHours = String(hours).padStart(2, "0");
  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = String(seconds).padStart(2, "0");
  if (withoutTime) {
    return `${paddedDay}_${paddedMonth}_${paddedYear}`;
  }
  return `${paddedHours}:${paddedMinutes}:${paddedSeconds} - ${paddedDay}/${paddedMonth}/${paddedYear}`;
}

async function writeLog({ project, username, domain, data }) {
  const path = 'logs'
  const logName = `history_${timestampToUTC(Date.now(), true)}.lock`;
  const logFilePath = path + '/' + logName;

  try {
    if (!fs.existsSync(path)) {
      fs.mkdirSync(path);
      console.log(`Thư mục ${path} đã được tạo.`);
      console.log("")
    }

    const l = fs.readFileSync(logFilePath, "utf8") || "";
    const d = data.length > 700 ? data.slice(0, 700) + "......" : data;
    const logStr = `${timestampToUTC(
      Date.now()
    )}: [${project.toUpperCase()}] [${username}]\n${domain}\nresponse: ${JSON.stringify(
      d,
      null,
      2
    )}\n`;
    fs.writeFileSync(logFilePath, l + "\n" + logStr, {});
  } catch (e) {
    if (JSON.stringify(e).includes(`"syscall":"open","code":"ENOENT"`)) {
      fs.writeFile(logFilePath, "", (err, data) => {
        writeLog({ project, username, domain, data });
      });
    }
  }
}

const public = {
  innerLog,
  delay,
  timestampToUTC,
  milisecondToRemainTime,
  profileSumary,
  profile,
  time,
  setTime,
  state,
  STRING,
  writeLog,
  loadConfig, loadConfigDecode, rPath, getRandomRange
};

module.exports = public;
