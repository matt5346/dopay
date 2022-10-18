import { Contract, utils, BigNumber } from "ethers";
import {log} from "@/utils/AppLogger";
import Web3 from 'web3';
import {uploadData} from "@/api";
import {getSettings, getData} from "@/crypto/helpers/Ethereum";
import { notify } from "@kyvg/vue3-notification";

import {
    Ethereum,
    ConnectionStore,
    TokensABI,
} from '@/crypto/helpers'


class SmartContract {

    _address = null
    _type = null

    //  ethers contract instance
    _instance = null
    _provider = null

    metaData = {
        address: null,
        name: null,
        symbol: null,
        tokens: [],
        balance: 0
    }

    /*
    * @param options: object, address = string in hex, type = 'common' || 'bundle' || 'allowList'
    * */
    constructor({address, type = 'common'}){
        this._address = address
        this._type = type
        this.metaData.address = address
    }

    async fetchMetadata(){
        const Contract = await this._getInstance()
        try{
            this.metaData.name = await Contract.name()
            this.metaData.symbol = await Contract.symbol() || ''
        }
        catch (e){
            log('[SmartContract] Error get contract meta from contract ' + this._address, e);
        }
    }

    async formHandler(tokensAmount, receiver, tokenId, isTransfer, fromNetwork, toNetwork){
        // receiver 0xEE24e3A77936744aBC8D54302cC2b649dE8AC5A1
        // old mumbai contract 0x50567de3e7e9cd8adbba6ffe4458043aefa8228a
        // old mumbai token 0xd5348aDEcFcAE50AfF91b772A1CF87c94CB35790
        console.log(fromNetwork, toNetwork, tokenId, 'from ---> TO tokenId')

        // todo fix API
        return await uploadData('QmaHgt8nJ257pZQz5SSiYB2Qw1bz7FDDMuk5xG8irNmVNL')

        const provider = await this._getProvider()
        const web3 = new Web3(provider.provider.provider);
        const connectionData = getSettings(ConnectionStore.getNetwork().name)
        const chainData = getData(ConnectionStore.getNetwork().name)
        let chainId = 1

        if (chainData)  chainId = chainData.chainId

        const forwarderChecked = web3.utils.toChecksumAddress(connectionData.forwarderContractAddress)

        const abi = TokensABI.polygonErc20.ABI
        const forwarderContract = new Contract(forwarderChecked, abi, provider)

        receiver = web3.utils.toChecksumAddress(receiver)
        //Owner - это тот, кто залогинен
        const owner = (await web3.eth.getAccounts())[0]
        // console.log(forwarderContract, 'forwarderContract')

        // const owner = (await web3.eth.getAccounts())[0];
        const forwarderNonce = forwarderContract.getNonce ? await forwarderContract.getNonce(owner) : 0
        const token = web3.utils.toChecksumAddress(tokenId) // contract with permit
        const spender = connectionData.forwarderContractAddress
        const deadline = 1665411447;


        const erc20 = TokensABI[`usdc_${connectionData.blockchain.toLowerCase()}`].ABI
        const contract = new Contract(token, erc20, provider)
        const name = await contract.name()
        const tokenDecimals = await contract.decimals()
        const nonceOfContract = await contract.nonces(owner)

        const nonce = parseInt(utils.formatUnits(nonceOfContract, "wei"))
        const tokenWithDecimals = tokensAmount * Math.pow(10, tokenDecimals)
        const value = '18446205110165755834005948204546580960626098221936403173208959885300094367';
        const allowed = true

        // console.log('ChainID:', chainId)

        let native = false
        let isPermit = false
        
        let Permit = [];

        let EIP712Domain = [];


        let buildPermitData = {};

        console.log('Chain', chainId);

        // console.log(nonceOfContract)


        // if usdc on polygon, cause need salt for permit
        if (tokenId === '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174') {
            Permit = [
                { name: 'owner', type: 'address' },
                { name: 'spender', type: 'address' },
                { name: 'value', type: 'uint256' },
                { name: 'nonce', type: 'uint256' },
                { name: 'deadline', type: 'uint256' },
            ];

            EIP712Domain = [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' },
                { name: 'verifyingContract', type: 'address' },
                { name: 'salt', type: 'bytes32' }
            ]

            buildPermitData = JSON.stringify({
                primaryType: 'Permit',
                types: { EIP712Domain, Permit },
                domain: {
                    name,
                    version: '1',
                    verifyingContract: token,
                    salt: utils.hexZeroPad(BigNumber.from(137).toHexString(), 32)
                },
                message: { owner, spender, value, nonce, deadline },
            })
        // if MAINNET
        } else if (chainId === 1) {
            // keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)")
            Permit = [
                { name: 'owner', type: 'address' },
                { name: 'spender', type: 'address' },
                { name: 'value', type: 'uint256' },
                { name: 'nonce', type: 'uint256' },
                { name: 'deadline', type: 'uint256' },
            ];
            // keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
            EIP712Domain = [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' },
                { name: 'chainId', type: 'uint256' },
                { name: 'verifyingContract', type: 'address' },
            ]

            buildPermitData= JSON.stringify({
                primaryType: 'Permit',
                types: { EIP712Domain, Permit },
                domain: {
                    name,
                    version: '2',
                    chainId: 1,
                    verifyingContract: token,
                },
                message: { owner, spender, value, nonce, deadline },
            })
        // if ROPSTEN
        } else if (chainId === 3) {
            // PERMIT_TYPEHASH = keccak256("Permit(address holder,address spender,uint256 nonce,uint256 expiry,bool allowed)");
            Permit = [
                { name: 'holder', type: 'address' },
                { name: 'spender', type: 'address' },
                { name: 'nonce', type: 'uint256' },
                { name: 'expiry', type: 'uint256' },
                { name: 'allowed', type: 'bool' },
            ];
            // "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
            EIP712Domain = [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' },
                { name: 'chainId', type: 'uint256' },
                { name: 'verifyingContract', type: 'address' },
            ]

            buildPermitData= JSON.stringify({
                primaryType: 'Permit',
                types: { EIP712Domain, Permit },
                domain: {
                    name,
                    version: '1',
                    chainId,
                    verifyingContract: token,
                },
                message: { holder: owner, spender, nonce, expiry: deadline, allowed},
            })
        }
        
        const from = await web3.eth.getAccounts();
        const params = [from[0], buildPermitData];
        const method = 'eth_signTypedData_v4';
        const self = this;

        // console.log(owner, forwarderContractAddress, 'contract---111-')
        const allowanceForwarder = await contract.allowance(owner, connectionData.forwarderContractAddress)
        // console.log(contract, allowanceForwarder, 'contract----')
        const gasData = await this.countGasPrice()
        const totalGas = gasData.totalGas
        const tokenPrice_ = gasData.tokenPrice_

        let valueFromSender = tokenWithDecimals + 3 * Math.round(totalGas/10**12)	 // gas



        const valueToReceiver = tokenWithDecimals

        if (native == true){
            valueFromSender = valueFromSender / tokenPrice_;
        }
        // console.log("utils.formatUnits(allowanceForwarder, wei) valueFromSender", utils.formatUnits(allowanceForwarder, "wei"), valueFromSender)
        // // console.log("Permit: ", buildPermitData)
        // // console.log("method: ", from[0])
        // // console.log("valueFromSender: utils.formatUnits(allowanceForwarder, wei", valueFromSender, utils.formatUnits(allowanceForwarder, "wei"))
        // console.log("Permit: ", buildPermitData)


        // console.log(method)
        // console.log(params)
        // console.log(from[0])

        if (valueFromSender > utils.formatUnits(allowanceForwarder, "wei")) {
            isPermit = true
            web3.currentProvider.sendAsync(
                {
                method,
                params,
                from: from[0],
                },
                async function (err, result) {
                    if (err) return console.dir(err);
                    if (result.error) {
                        alert(result.error.message);
                    }
                    if (result.error) return console.error('ERROR', result);
                
                    const { v,r,s } = utils.splitSignature(result.result);

                    let permitMessage = {
                        'owner': owner,
                        'spender': spender,
                        'value': value,
                        'deadline': deadline,
                        'v': v ,
                        'r': r,
                        's': s
                    }
                    // console.log('Permit: ', permitMessage, v, r, s)

                    try{
                        // const tx = await contract.permit(owner, spender, value, deadline, v, r, s, { gasLimit: 100000 })
                        // console.log(tx, 'tx approve')
                        const args = {
                            valueFromSender,
                            receiver,
                            valueToReceiver,
                            permitMessage: {...permitMessage, v, r, s},
                            forwarderNonce,
                            isPermit,
                            token,
                            native,
                            toNetwork
                        }

                        await self.executeForwardContract(args)
                    }
                    catch (e){
                        console.log('mint error', e);
                    }
                }
            );
        }
        else {
            try{
                let permitMessage = {
                    'owner': '',
                    'spender': '',
                    'value': 0,
                    'deadline': 0
                }
                let v = 0
                let r = ''
                let s = ''

                const args = {
                    valueFromSender,
                    receiver,
                    valueToReceiver,
                    permitMessage: {...permitMessage, v, r, s},
                    forwarderNonce,
                    isPermit,
                    token,
                    native,
                    toNetwork
                }

                await self.executeForwardContract(args)
            }
            catch (e){
                console.log('mint error', e);
            }
        }
    }
    

    async executeForwardContract({
        valueFromSender,
        receiver,
        valueToReceiver,
        permitMessage,
        forwarderNonce,
        isPermit,
        token,
        native,
        toChainId,
    }) {
        // console.log(web3, valueFromSender, 'executeForwardContract valueFromSender')
        const provider = await this._getProvider()
        const web3 = new Web3(provider.provider.provider);

        // console.log(token, 'TOKEN IDD')
        const owner = (await web3.eth.getAccounts())[0];
        const nonce = utils.formatUnits(forwarderNonce, "wei")
        const { forwarderContractAddress } = getSettings(ConnectionStore.getNetwork().name)
        const forwarder = web3.utils.toChecksumAddress(forwarderContractAddress)
        const { chainId } = getData(ConnectionStore.getNetwork().name)
        const deBridge_address = '0x43de2d77bf8027e25dbd179b491e8d64f38398aa';
        const deBridge_abi = TokensABI.DebridgeContract.ABI;
        const debridgeContract = new Contract(deBridge_address, deBridge_abi, provider)

        const name = 'doTransfer'


        const ForwardRequest = [
            { name: 'from', type: 'address' },
            { name: 'to', type: 'address' },
            { name: 'receiver', type: 'address' },
            { name: 'token', type: 'address' },
            { name: 'valueFromSender', type: 'uint256' },
            { name: 'valueToReceiver', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'toChainId', type: 'uint256' },
        ];

        let EIP712Domain = [];

        let domain = {}

        // if usdc on polygon, cause need salt for permit
        if (token === '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174') {
            EIP712Domain = [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' },
                { name: 'verifyingContract', type: 'address' },
                { name: 'salt', type: 'bytes32' }
            ]

            domain = {
                name,
                version: '1',
                verifyingContract: forwarder,
                salt: utils.hexZeroPad(BigNumber.from(137).toHexString(), 32)
            }

        // if MAINNET
        } else if (chainId === 1) {
            // keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
            EIP712Domain = [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' },
                { name: 'chainId', type: 'uint256' },
                { name: 'verifyingContract', type: 'address' },
            ]

            domain = {
                name,
                version: '1',
                chainId: 1,
                verifyingContract: forwarder,
            }
        // if ROPSTEN
        } else if (chainId === 3) {
            // "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
            EIP712Domain = [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' },
                { name: 'chainId', type: 'uint256' },
                { name: 'verifyingContract', type: 'address' },
            ]
            domain = {
                name,
                version: '1',
                chainId,
                verifyingContract: forwarder,
            }
        }

        const buildForwardData = JSON.stringify({
            primaryType: 'doRequest',
            types: { EIP712Domain, ForwardRequest },
            domain,
            message: {
                from: owner,
                to: forwarder,
                receiver: deBridge_address,
                token,
                valueFromSender: Math.round(valueFromSender).toString(),
                valueToReceiver: valueToReceiver.toString(),
                nonce,
                toChainId,
            },
        });

        const DeBridge_message =  {
            'data': '0x',
            'executionFee': 0,
            'receiver': owner,
            'permit': '0x',
            'useAssetFee': false,
            'referralCode': 0
        }

        const fee = +(await debridgeContract.globalFixedNativeFee())

        const options = {
            value: fee
        }

        console.log(fee, '---FEEE----')

        // console.log(chainId)
        const from = await web3.eth.getAccounts();

        console.log(buildForwardData)
    
        const params = [from[0], buildForwardData];
        const method = 'eth_signTypedData_v4';
        web3.currentProvider.sendAsync(
            {
            method,
            params,
            from: from[0],
            },
            async function (err, result) {
                // console.log(err, 'err 3')
                // console.log(result, 'result 3')
                if (err) return console.dir(err);
                if (result.error) {
                    alert(result.error.message);
                }
                if (result.error) return console.error('ERROR', result);
            
                const requestMessage = JSON.parse(buildForwardData).message

                try{
                    notify({
                        title: "Transaction sent!",
                        type: "success",
                        duration: 10000
                    });

                    // DEBRIDGE implementation

                    let tx_hash = await uploadData(requestMessage, permitMessage, result.result, DeBridge_message, options)
                    // console.log(permitMessage, 'permitMessage')
                    // console.log('Estimate:', await contract.estimateGas.execute(objData, permitMessage, result.result, true, false));
                    // const txExecute = await contract.execute(objData, permitMessage, result.result, isPermit, native, { value: valueToReceiver, gasLimit: 150000 })
                    console.log("tx_hash", tx_hash)

                    if (!tx_hash) {
                        notify({
                            title: "Oh, smth wrong!",
                            text: tx_hash || 'Transaction failed for some reasons',
                            type: "error",
                            duration: 20000
                        });
                    } else {
                        notify({
                            title: "Transaction result:",
                            text: `<a target="_blank" href="https://etherscan.io/tx/${tx_hash}">Transaction link<a>`,
                            duration: 20000
                        });
                    }

                }
                catch (e){
                    notify({
                        title: "Oh, smth wrong!",
                        text: e,
                        type: "error",
                        duration: 10000
                    });
                    console.log('sendAsync executeForwardContract error', e);
                }
            }
        );

    }


    async fetchBalance(){
        const provider = await this._getProvider()

        // todo: defaultActiveToken change on current tokenId from list
        const { erc20AbiName, nativeAddress, blockchain, defaultActiveToken } = getSettings(ConnectionStore.getNetwork().name)
        // console.log(erc20AbiName, 'erc20AbiName')
        const web3 = new Web3(provider.provider.provider);
        const native = web3.utils.toChecksumAddress(nativeAddress)
        const owner = (await web3.eth.getAccounts())[0]
        const erc20 = TokensABI[erc20AbiName].ABI
        const stableErc20 = TokensABI[`usdc_${blockchain.toLowerCase()}`].ABI
        const stableContract = new Contract(defaultActiveToken, stableErc20, provider)

        const contractNative = new Contract(native, erc20, provider)
        // console.log(web3.eth.defaultCommon, '-----WEB3')

        const nativeBalance = await web3.eth.getBalance(owner)
        const nativeDecimals = await contractNative.decimals()
        const nativeName = await contractNative.symbol()

        const nativeAmount = utils.formatUnits(nativeBalance, "wei") / (10 ** nativeDecimals)
        // console.log(stableContract, 'stableContract')

        const tokenBalance = await stableContract.balanceOf(owner)
        const tokenDecimals = await stableContract.decimals()
        const tokenName = await stableContract.symbol()

        const tokenAmount = utils.formatUnits(tokenBalance, "wei") / (10 ** tokenDecimals)
        // console.log(tokenAmount, 'tokenAmount')

        return {
            native: {
                name: nativeName,
                amount: nativeAmount
            },
            token: {
                name: tokenName,
                amount: tokenAmount
            },
        }
    }
   
    async countGasPrice() {
        const tokensAmount = '0'
        const { blockchain, chainlinkPriceAddress, defaultActiveToken, chainlinkRpc } = getSettings(ConnectionStore.getNetwork().name)
        const receiver = '0xAe584Eb4F714a7735bF005649a804b6942627cb2'
        const provider = await this._getProvider()
        const web3 = new Web3(provider.provider.provider);
        const aggregatorV3InterfaceABI = TokensABI.ChainLinkABI.ABI
        const chainlinkWeb3 = new Web3(chainlinkRpc)
        const chainlinkPrices = web3.utils.toChecksumAddress(chainlinkPriceAddress)
        const priceFeed = new chainlinkWeb3.eth.Contract(aggregatorV3InterfaceABI, chainlinkPrices)

        // todo: count gas for all networks
        // currently only polygon/eth check more
        const erc20 = TokensABI[`usdc_${blockchain.toLowerCase()}`].ABI
        const contract = new Contract(defaultActiveToken, erc20, provider)

        let tokenPrice = null

        await priceFeed.methods.latestRoundData().call()
            .then((roundData) => {
                // Do something with roundData
                // console.log("roundData.answer.length", roundData.answer.length === 8)
                if (roundData.answer.length === 8) {
                    tokenPrice = `0,${roundData.answer}`
                } else {
                    tokenPrice = roundData.answer / 10 ** 8
                }
                // console.log(roundData, 'roundData.answer')
            })

        let estimation = await contract.estimateGas.transfer(receiver, tokensAmount);
        estimation = utils.formatUnits(estimation, "wei")


        let gasPrice = await provider.getGasPrice()
        gasPrice = utils.formatUnits(gasPrice, "wei")

        let tokenPrice_ = parseFloat(tokenPrice.toString().replace(",", "."));

        let totalGas = estimation * gasPrice * tokenPrice_
        return { totalGas, tokenPrice_ }
    }

    async _getInstance(){
        if(!this._instance){
            this._instance = await new Promise( async (resolve) => {
                let abi = TokensABI.default.ABI
                if(this._address == null)
                    this._address = Ethereum.getSettings(ConnectionStore.getNetwork().name).tokenAddress
                const contract = new Contract(this._address, abi, this._getProvider())
                resolve(contract)
            })
        }
        return this._instance
    }

    _getProvider(){
        if(!this._provider) this._provider = ConnectionStore.getProvider();
        return this._provider
    }

}

export default SmartContract