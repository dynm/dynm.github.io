/*!
* YieldFarming
* Boilerplate for a Static website using EJS and SASS
* https://yieldfarming.info
* @author Jongseung Lim -- https://yieldfarming.info
* Copyright 2020. MIT Licensed.
*/

$(function () {
    consoleInit();
    start(main);
});

async function loadPool(App, tokens, prices, stakingAbi, stakingAddress,
    rewardTokenFunction, stakeTokenFunction) {
    const STAKING_POOL = new ethers.Contract(stakingAddress, stakingAbi, App.provider);

    const stakeTokenAddress = await STAKING_POOL.callStatic[stakeTokenFunction]();

    const rewardTokenAddress = await STAKING_POOL.callStatic[rewardTokenFunction]();

    var stakeToken = await getToken(App, stakeTokenAddress, stakingAddress);

    if (stakeTokenAddress.toLowerCase() === rewardTokenAddress.toLowerCase()) {
        stakeToken.staked = await STAKING_POOL.totalSupply() / 10 ** stakeToken.decimals;
    }

    var newPriceAddresses = stakeToken.tokens.filter(x =>
        !getParameterCaseInsensitive(prices, x));
    var newPrices = await lookUpTokenPrices(newPriceAddresses);
    for (const key in newPrices) {
        if (newPrices[key])
            prices[key] = newPrices[key];
    }
    if (stakeTokenFunction === "SUSD") {
        prices[stakeTokenAddress] = { usd: 1 }; //...
    }
    var newTokenAddresses = stakeToken.tokens.filter(x =>
        !getParameterCaseInsensitive(tokens, x));
    for (const address of newTokenAddresses) {
        tokens[address] = await getToken(App, address, stakingAddress);
    }
    if (!getParameterCaseInsensitive(tokens, rewardTokenAddress)) {
        tokens[rewardTokenAddress] = await getToken(App, rewardTokenAddress, stakingAddress);
    }
    const rewardToken = getParameterCaseInsensitive(tokens, rewardTokenAddress);

    const rewardTokenTicker = rewardToken.symbol;

    const poolPrices = getPoolPrices(tokens, prices, stakeToken);

    const stakingTokenTicker = poolPrices.stakingTokenTicker;

    const stakeTokenPrice =
        prices[stakeTokenAddress]?.usd ?? getParameterCaseInsensitive(prices, stakeTokenAddress)?.usd;
    const rewardTokenPrice = getParameterCaseInsensitive(prices, rewardTokenAddress)?.usd;

    // Find out reward rate
    const weeklyRewards = await get_synth_weekly_rewards(STAKING_POOL);

    const usdPerWeek = weeklyRewards * rewardTokenPrice;

    const staked_tvl = poolPrices.staked_tvl;

    const userStaked = await STAKING_POOL.balanceOf(App.YOUR_ADDRESS) / 10 ** stakeToken.decimals;

    const userUnstaked = stakeToken.unstaked;

    const earned = await STAKING_POOL.earned(App.YOUR_ADDRESS) / 10 ** rewardToken.decimals;

    poolPrices.print_price();
    _print(`${rewardTokenTicker} Per Week: ${weeklyRewards.toFixed(2)} ($${formatMoney(usdPerWeek)})`);
    const weeklyAPY = usdPerWeek / staked_tvl * 100;
    const dailyAPY = weeklyAPY / 7;
    const yearlyAPY = weeklyAPY * 52;
    _print(`APY: Day ${dailyAPY.toFixed(2)}% Week ${weeklyAPY.toFixed(2)}% Year ${yearlyAPY.toFixed(2)}%`);
    const userStakedUsd = userStaked * stakeTokenPrice;
    const userStakedPct = userStakedUsd / staked_tvl * 100;
    _print(`You are staking ${userStaked.toFixed(6)} ${stakingTokenTicker} ` +
        `$${formatMoney(userStakedUsd)} (${userStakedPct.toFixed(2)}% of the pool).`);
    if (userStaked > 0) {
        const userWeeklyRewards = userStakedPct * weeklyRewards / 100;
        const userDailyRewards = userWeeklyRewards / 7;
        const userYearlyRewards = userWeeklyRewards * 52;
        _print(`Estimated ${rewardTokenTicker} earnings:`
            + ` Day ${userDailyRewards.toFixed(2)} ($${formatMoney(userDailyRewards * rewardTokenPrice)})`
            + ` Week ${userWeeklyRewards.toFixed(2)} ($${formatMoney(userWeeklyRewards * rewardTokenPrice)})`
            + ` Year ${userYearlyRewards.toFixed(2)} ($${formatMoney(userYearlyRewards * rewardTokenPrice)})`);
    }
    const approveTENDAndStake = async function () {
        return rewardsContract_stake(stakeTokenAddress, stakingAddress, App)
    }
    const unstake = async function () {
        return rewardsContract_unstake(stakingAddress, App)
    }
    const claim = async function () {
        return rewardsContract_claim(stakingAddress, App)
    }
    const exit = async function () {
        return rewardsContract_exit(stakingAddress, App)
    }
    const revoke = async function () {
        return rewardsContract_resetApprove(stakeTokenAddress, stakingAddress, App)
    }
    if (stakeTokenFunction !== "mith") {
        _print_link(`Stake ${userUnstaked.toFixed(6)} ${stakingTokenTicker}`, approveTENDAndStake)
    }
    _print_link(`Unstake ${userStaked.toFixed(6)} ${stakingTokenTicker}`, unstake)
    _print_link(`Claim ${earned.toFixed(6)} ${rewardTokenTicker}`, claim)
    _print_link(`Revoke (set approval to 0)`, revoke)
    _print_link(`Exit`, exit)
    _print(`\n`);
}

async function loadBoardroom(App, tokens, prices) {
    const BOARDROOM_ADDRESS = "0xb35f89160d1Dc47B6EAC1986D7821505c327AE09";
    const BOARDROOM = new ethers.Contract(BOARDROOM_ADDRESS, BOARDROOM_ABI, App.provider);
    const share = await BOARDROOM.share();
    const SHARE = new ethers.Contract(share, ERC20_ABI, App.provider);
    const userUnstaked = await SHARE.balanceOf(App.YOUR_ADDRESS) / 1e18;
    const sharePrice = getParameterCaseInsensitive(prices, share)?.usd;
    const userStaked = await BOARDROOM.balanceOf(App.YOUR_ADDRESS) / 1e18;
    const userStakedUsd = userStaked * sharePrice;
    const totalStaked = await BOARDROOM.totalSupply() / 1e18;
    const totalStakedUsd = totalStaked * sharePrice;
    const userPct = userStaked / totalStaked * 100;
    const earned = await BOARDROOM.earned(App.YOUR_ADDRESS) / 1e18;
    _print(`Boardroom`);
    _print(`There is a total ${totalStaked.toFixed(2)} BCS ($${formatMoney(totalStakedUsd)}) staked in the Boardroom.`)
    _print(`You are staking ${userStaked} BCS ($${formatMoney(userStakedUsd)}), ${userPct.toFixed(2)}% of the pool.`);

    const approveTENDAndStake = async () => rewardsContract_stake(share, BOARDROOM_ADDRESS, App);
    const unstake = async () => rewardsContract_unstake(BOARDROOM_ADDRESS, App);
    const claim = async () => rewardsContract_claim(BOARDROOM_ADDRESS, App);
    const exit = async () => rewardsContract_exit(BOARDROOM_ADDRESS, App);
    const revoke = async () => rewardsContract_resetApprove(share, BOARDROOM_ADDRESS, App);

    _print_link(`Stake ${userUnstaked.toFixed(2)} BCS`, approveTENDAndStake)
    _print_link(`Unstake ${userStaked.toFixed(2)} BCS`, unstake)
    _print_link(`Claim ${earned.toFixed(2)} MIC`, claim)
    _print_link(`Revoke (set approval to 0)`, revoke)
    _print_link(`Exit`, exit)
    _print(`\n`);
}

async function main() {
    const CONTRACTS = [
        { address: "0x674d4a53C708017d9c8337c714A7E09007F5B323", abi: BCC_DAIBCS_ABI, rewardToken: "basisShare", stakeToken: "lpt" },
        { address: "0xE545097E7A47F1E007b0A998e8a00741b9477B20", abi: BCC_DAIBCC_ABI, rewardToken: "basisShare", stakeToken: "lpt" },
        { address: "0x34f24991234067B63149D34691B5C17641Afe60C", abi: BCC_BAC_ABI, rewardToken: "basisCash", stakeToken: "bac" },
        { address: "0x08986f3E298fA25ebA13b1B5507c6569F653a0d1", abi: BCC_BAS_ABI, rewardToken: "basisCash", stakeToken: "bas" },
        { address: "0xd12ff490eed822924f022ded3d272f3eebd3859e", abi: BCC_DAI_ABI, rewardToken: "basisCash", stakeToken: "dai" },
        { address: "0x3fdc28901216c6ed39e0cfad89b8111bd46033bc", abi: BCC_USDC_ABI, rewardToken: "basisCash", stakeToken: "usdc" },
        
    ];

    const App = await init_ethers();

    _print(`Initialized ${App.YOUR_ADDRESS}`);
    _print("Reading smart contracts...\n");

    var tokens = {};
    var prices = {};

    for (const c of CONTRACTS) {
        try {
            await loadPool(App, tokens, prices, c.abi, c.address, c.rewardToken, c.stakeToken);
        }
        catch (ex) {
            console.error(ex);
        }
    }

    await loadBoardroom(App, tokens, prices);

    hideLoading();
}
