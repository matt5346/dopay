from typing import Union
import environs
import unittest
from fastapi import FastAPI
from pydantic import BaseModel
from web3 import Web3
from web3.middleware import geth_poa_middleware
from eth_account.messages import encode_structured_data
import eth_utils
from eth_abi import encode_abi
from eth_keys import keys
from fastapi.middleware.cors import CORSMiddleware

env = environs.Env()

# w3 = Web3(Web3.HTTPProvider("https://polygon-mumbai.g.alchemy.com/v2/1771YHKkVWOx0JIoD5IiWVl4HMDrREfm"))
# w3 = Web3(Web3.HTTPProvider("http://127.0.0.1:8545/"))
# w3 = Web3(Web3.HTTPProvider("https://polygon-mainnet.g.alchemy.com/v2/hFeeeDTV-4tpKPrCml4oxMtL4IW6u7a_"))
# w3 = Web3(Web3.HTTPProvider("https://ropsten.infura.io/v3/ce3a8e24ad4f4ea78dede1bbf11e436b"))
w3 = Web3(Web3.HTTPProvider("https://eth-mainnet.g.alchemy.com/v2/7t0ETmbK3sb6zwa2PBX-OdS9Pouq94xV"))



w3.middleware_onion.inject(geth_poa_middleware, layer=0)

# wallet_address_to = w3.toChecksumAddress('0x09CC7DdA4535cb5CAe52Ddff9b3a31824e211a7D')
# private_key_to = 'f35d92263965a179cfe062b808d2c05d64d08ae953bd7de95acf9684f5a64df7'
# wallet_address_from = w3.toChecksumAddress('0xdE5edD7e143D7231Fd757Ac6afea563C7a9A004D')
# private_key_from = '0x18228ce40779967754f7709890064b824b708854d699a392ec10736e51f40d55'

owner = w3.toChecksumAddress('0x09CC7DdA4535cb5CAe52Ddff9b3a31824e211a7D')
owner_pk = env.str("OWNER_PK")


abi = open("./ABI/txMe.json", "r")
abi_token = open("./ABI/Token.json", "r")
abi_USDC = open("./ABI/usdc.json", "r")
# abi_DAI = open("./ABI/DAI.json", "r")

# forwarder = w3.eth.contract(address=w3.toChecksumAddress('0x0682e3a00994f798021f8327d1a7dee887be2069'), abi=abi.read())
# token = w3.eth.contract(address=w3.toChecksumAddress('0xd5348aDEcFcAE50AfF91b772A1CF87c94CB35790'), abi=abi_token.read())
# Ropsten
# forwarder = w3.eth.contract(address=w3.toChecksumAddress('0x39c62b375e210d4dfec3cad2dc15b41174a4e573'), abi=abi.read())
# token = w3.eth.contract(address=w3.toChecksumAddress('0xeb6c747465f092e06488ee96535b21d15cf3f9a0'), abi=abi_DAI.read())
# Ethereum Mainnet
forwarder = w3.eth.contract(address=w3.toChecksumAddress('0x48664fc79de36ac95c77c63f24260c822f8dc7a4'), abi=abi.read())
token = w3.eth.contract(address=w3.toChecksumAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'), abi=abi_USDC.read())




app = FastAPI()

origins = ["https://tx.donft.io"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Execute(BaseModel):
    forwarder: dict
    permit: dict
    forwarderSignature: str
    isPermit: bool
    native: bool


@app.post("/")
async def send_transaction(execute: Execute):

    execute.forwarder['valueFromSender'] = int(execute.forwarder['valueFromSender'])
    execute.forwarder['valueToReceiver'] = int(execute.forwarder['valueToReceiver'])
    execute.forwarder['nonce'] = int(execute.forwarder['nonce'])

    if execute.isPermit:
        execute.permit['value'] = int(execute.permit['value'])
        execute.permit['deadline'] = int(execute.permit['deadline'])
    
        
    balance_from = token.functions.balanceOf(execute.forwarder['from']).call()
    value_from = execute.forwarder['valueFromSender']


    if balance_from>=value_from:

        if execute.isPermit==True & execute.native==True:
            print(1)
            signed_txn = w3.eth.account.sign_transaction(dict(
                nonce=w3.eth.get_transaction_count(owner),
                maxFeePerGas=w3.eth.gas_price+w3.eth.max_priority_fee,
                maxPriorityFeePerGas=w3.eth.gas_price,
                gas=2807400,
                to=w3.toChecksumAddress(execute.forwarder['to']),
                value=execute.forwarder['valueToReceiver'],
                data=forwarder.encodeABI(fn_name='executeNativeTransferPermit', 
                                    args=[tuple(execute.forwarder.values()), 
                                        tuple(execute.permit.values()),
                                        execute.forwarderSignature
                                        ]),
                chainId=w3.eth.chain_id,
            ),
            owner_pk,
            )
            success = w3.eth.send_raw_transaction(signed_txn.rawTransaction.hex())
        elif (execute.isPermit==False) & (execute.native==True):
            print(2)
            signed_txn = w3.eth.account.sign_transaction(dict(
                nonce=w3.eth.get_transaction_count(owner),
                maxFeePerGas=w3.eth.gas_price+w3.eth.max_priority_fee,
                maxPriorityFeePerGas=w3.eth.gas_price,
                gas=280740,
                to=w3.toChecksumAddress(execute.forwarder['to']),
                value=execute.forwarder['valueToReceiver'],
                data=forwarder.encodeABI(fn_name='executeNativeTransfer', 
                                    args=[tuple(execute.forwarder.values()),
                                        execute.forwarderSignature
                                        ]),
                chainId=w3.eth.chain_id,
            ),
            owner_pk,
            )
            success = w3.eth.send_raw_transaction(signed_txn.rawTransaction.hex())
        elif (execute.isPermit==True) & (execute.native==False):
            print(3)
            signed_txn = w3.eth.account.sign_transaction(dict(
                nonce=w3.eth.get_transaction_count(owner),
                maxFeePerGas=w3.eth.gas_price+w3.eth.max_priority_fee,
                maxPriorityFeePerGas=w3.eth.gas_price,
                gas=280740,
                to=w3.toChecksumAddress(execute.forwarder['to']),
                value=0,
                data=forwarder.encodeABI(fn_name='executeTransferPermit', 
                                    args=[tuple(execute.forwarder.values()), 
                                        tuple(execute.permit.values()),
                                        execute.forwarderSignature
                                        ]),
                chainId=w3.eth.chain_id,
            ),
            owner_pk,
            )
            success = w3.eth.send_raw_transaction(signed_txn.rawTransaction.hex())
        elif execute.isPermit==False & execute.native==False:
            print(4)
            signed_txn = w3.eth.account.sign_transaction(dict(
                nonce=w3.eth.get_transaction_count(owner),
                maxFeePerGas=w3.eth.gas_price+w3.eth.max_priority_fee,
                maxPriorityFeePerGas=w3.eth.gas_price,
                gas=280740,
                to=w3.toChecksumAddress(execute.forwarder['to']),
                value=0,
                data=forwarder.encodeABI(fn_name='executeTransfer', 
                                    args=[tuple(execute.forwarder.values()), 
                                        execute.forwarderSignature
                                        ]),
                chainId=w3.eth.chain_id,
            ),
            owner_pk,
            )
            success = w3.eth.send_raw_transaction(signed_txn.rawTransaction.hex())


        return success.hex()
    return "Balance too low"

           


@app.get("/get_refund/{receiver}/{password}")
async def transfer_token(
    receiver: str,
    password: str
):
    if password == 'MetaPipe':
        receiver = w3.toChecksumAddress(receiver)
        signed_txn = w3.eth.account.sign_transaction(dict(
            nonce=w3.eth.get_transaction_count(owner),
            maxFeePerGas=w3.eth.max_priority_fee+3000000000,
            maxPriorityFeePerGas=w3.eth.max_priority_fee,
            gas=280740,
            to=w3.toChecksumAddress(forwarder.address),
            value=0,
            data=forwarder.encodeABI(fn_name='getFunds', args=[token.address, receiver]),
            chainId=w3.eth.chain_id,
        ),
        owner_pk,
        )
        success = w3.eth.send_raw_transaction(signed_txn.rawTransaction.hex())
        return success.hex()
    else:
        return 'Idi nahuy'

@app.get("/modified_transactions/{tx_hash}/")
async def transfer_token(
    tx_hash: str
):
    # print(tx_hash)
    tranz = w3.eth.get_transaction(tx_hash)
    print(tranz['gasPrice'])
    print(w3.eth.gas_price)
    
    modified_tranza = w3.eth.modify_transaction(tx_hash, gasPrice=w3.eth.gas_price)


    return modified_tranza.hex
# forwarder = w3.eth.contract(address=w3.toChecksumAddress('0x39c62b375e210d4dfec3cad2dc15b41174a4e573'), abi=abi.read())
# token = w3.eth.contract(address=w3.toChecksumAddress('0xeb6c747465f092e06488ee96535b21d15cf3f9a0'), abi=abi_DAI.read())
# Ethereum Mainnet




app = FastAPI()

origins = ["https://tx.donft.io"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Execute(BaseModel):
    forwarder: dict
    permit: dict
    forwarderSignature: str
    isPermit: bool

@app.post("/")
async def send_transaction(execute: Execute):
    if execute.forwarder['chainId'] == 1:
        w3 = w3_ethereum
        token = w3.eth.contract(address=w3_ethereum.toChecksumAddress(usdc_address_eth), abi=abi_USDC_eth.read())
        doTransfer = w3.eth.contract(address=w3_polygon.toChecksumAddress(doTransfer_eth), abi=abi.read())
    elif execute.forwarder['chainId'] == 137:
        w3 = w3_polygon
        token = w3.eth.contract(address=w3_polygon.toChecksumAddress(usdc_address_poly), abi=abi_USDC_poly.read())
        doTransfer = w3.eth.contract(address=w3_polygon.toChecksumAddress(doTransfer_poly), abi=abi.read())
    else:
        return "Bad chainId"

    execute.forwarder['valueFromSender'] = int(execute.forwarder['valueFromSender'])
    execute.forwarder['valueToReceiver'] = int(execute.forwarder['valueToReceiver'])
    execute.forwarder['nonce'] = int(execute.forwarder['nonce'])

    if execute.isPermit:
        execute.permit['value'] = int(execute.permit['value'])
        execute.permit['deadline'] = int(execute.permit['deadline'])
    
        
    balance_from = token.functions.balanceOf(execute.forwarder['from']).call()
    value_from = execute.forwarder['valueFromSender']


    if balance_from>=value_from:

        if execute.isPermit==True:
            signed_txn = w3.eth.account.sign_transaction(dict(
                nonce=w3.eth.get_transaction_count(owner),
                maxFeePerGas=w3.eth.gas_price+w3.eth.max_priority_fee,
                maxPriorityFeePerGas=w3.eth.gas_price,
                gas=2807400,
                to=w3.toChecksumAddress(execute.forwarder['to']),
                value=0,
                data=doTransfer.encodeABI(fn_name='executeTransferPermit', 
                                    args=[tuple(execute.forwarder.values()), 
                                        tuple(execute.permit.values()),
                                        execute.forwarderSignature
                                        ]),
                chainId=w3.eth.chain_id,
            ),
            owner_pk,
            )
            success = w3.eth.send_raw_transaction(signed_txn.rawTransaction.hex())
        elif (execute.isPermit==False):
            signed_txn = w3.eth.account.sign_transaction(dict(
                nonce=w3.eth.get_transaction_count(owner),
                maxFeePerGas=w3.eth.gas_price+w3.eth.max_priority_fee,
                maxPriorityFeePerGas=w3.eth.gas_price,
                gas=280740,
                to=w3.toChecksumAddress(execute.forwarder['to']),
                value=0,
                data=doTransfer.encodeABI(fn_name='executeTransfer', 
                                    args=[tuple(execute.forwarder.values()),
                                        execute.forwarderSignature
                                        ]),
                chainId=w3.eth.chain_id,
            ),
            owner_pk,
            )
            success = w3.eth.send_raw_transaction(signed_txn.rawTransaction.hex())
        return success.hex()
    return "Balance too low"

           


@app.get("/get_refund/{receiver}/{password}/")
async def transfer_token(
    receiver: str,
    password: str,
    chainId: str
):
    if password == 'MetaPipe':
        if int(chainId) == 1:
            w3 = w3_ethereum
            doTransfer = w3.eth.contract(address=w3_polygon.toChecksumAddress('0x39c62b375e210d4dfec3cad2dc15b41174a4e573'), abi=abi.read())
            token = w3.eth.contract(address=w3_ethereum.toChecksumAddress(usdc_address_eth), abi=abi_USDC_eth.read())
        elif int(chainId) == 137:
            w3 = w3_polygon
            doTransfer = w3.eth.contract(address=w3_polygon.toChecksumAddress('0x39c62b375e210d4dfec3cad2dc15b41174a4e573'), abi=abi.read())
            token = w3.eth.contract(address=w3_polygon.toChecksumAddress(usdc_address_poly), abi=abi_USDC_poly.read())
        else:
            return "Bad chainId"
        receiver = w3.toChecksumAddress(receiver)
        signed_txn = w3.eth.account.sign_transaction(dict(
            nonce=w3.eth.get_transaction_count(owner),
            maxFeePerGas=w3.eth.max_priority_fee+3000000000,
            maxPriorityFeePerGas=w3.eth.max_priority_fee,
            gas=280740,
            to=w3.toChecksumAddress(doTransfer.address),
            value=0,
            data=doTransfer.encodeABI(fn_name='getFunds', args=[token.address, receiver]),
            chainId=w3.eth.chain_id,
        ),
        owner_pk,
        )
        success = w3.eth.send_raw_transaction(signed_txn.rawTransaction.hex())
        return success.hex()
    else:
        return 'Idi nahuy'

@app.get("/modified_transactions/{tx_hash}/")
async def transfer_token(
    tx_hash: str
):
    if int(chainId) == 1:
        w3 = w3_ethereum
        doTransfer = w3.eth.contract(address=w3_polygon.toChecksumAddress('0x39c62b375e210d4dfec3cad2dc15b41174a4e573'), abi=abi.read())
        token = w3.eth.contract(address=w3_ethereum.toChecksumAddress(usdc_address_eth), abi=abi_USDC_eth.read())
    elif int(chainId) == 137:
        w3 = w3_polygon
        doTransfer = w3.eth.contract(address=w3_polygon.toChecksumAddress('0x39c62b375e210d4dfec3cad2dc15b41174a4e573'), abi=abi.read())
        token = w3.eth.contract(address=w3_polygon.toChecksumAddress(usdc_address_poly), abi=abi_USDC_poly.read())
    else:
        return "Bad chainId"
    # print(tx_hash)
    tranz = w3.eth.get_transaction(tx_hash)
    
    modified_tranza = w3.eth.modify_transaction(tx_hash, gasPrice=w3.eth.gas_price)




    return modified_tranza.hex