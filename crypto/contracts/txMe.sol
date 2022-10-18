// SPDX-License-Identifier: MIT
// Further information: https://eips.ethereum.org/EIPS/eip-2770
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol";

/**
 * @title Forwarder Smart Contract
 * @author Pascal Marco Caversaccio, pascal.caversaccio@hotmail.ch
 * @dev Simple forwarder for extensible meta-transaction forwarding.
 */

contract txMe is Ownable, EIP712 {
    using ECDSA for bytes32;

    struct ForwardRequest {
        address from;       // Externally-owned account (EOA) making the request.
        address to;         // Destination address, normally a smart contract.
        address receiver;   // Receiver
        address token;   // Receiver
        uint256 valueFromSender;   //
        uint256 valueToReceiver;   //
        uint256 nonce;      // On-chain tracked nonce of a transaction.
    }

    struct Permit {
        address owner;
        address spender;
        uint256 value;
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;        
    }

    bytes32 private constant _TYPEHASH = keccak256("ForwardRequest(address from,address to,address receiver,address token,uint256 valueFromSender,uint256 valueToReceiver,uint256 nonce)");

    bytes4 private constant _transferFrom = bytes4(keccak256("transferFrom(address,address,uint256)"));
    bytes4 private constant _transfer = bytes4(keccak256("transfer(address,uint256)"));


    mapping(address => uint256) private _nonces;
    mapping(address => bool) private _senderWhitelist;

    constructor(string memory name, string memory version) EIP712(name, version) {
        address msgSender = msg.sender;
        addSenderToWhitelist(msgSender);
    }

    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function getNonce(address from) public view returns (uint256) {
        return _nonces[from];
    }

    function verify(ForwardRequest calldata req, bytes calldata signature) public view returns (bool) {
        address signer = _hashTypedDataV4(keccak256(abi.encode(
            _TYPEHASH,
            req.from,
            req.to,
            req.receiver,
            req.token,
            req.valueFromSender,
            req.valueToReceiver,
            req.nonce
        ))).recover(signature);

        return _nonces[req.from] == req.nonce && signer == req.from;
    }

    function executeTransfer(ForwardRequest calldata req, 
                    bytes calldata signature) public{
        require(_senderWhitelist[msg.sender], "Sender is not whitelisted");

        require(IERC20(req.token).balanceOf(req.from) >= req.valueFromSender, "Check balance. ERC20: transfer amount exceeds balance");

        require(verify(req, signature), "Signature does not match");

        (bool success, bytes memory returndata) = 
                            req.token.call{value: 0}
                            (abi.encodeWithSelector(
                            _transferFrom, 
                            req.from, 
                            req.to, 
                            req.valueFromSender));

        require(success, "Function transferFrom failed");

        (bool sent, bytes memory data) = 
                            req.token.call{value: 0}
                            (abi.encodeWithSelector(
                            _transfer, 
                            req.receiver, 
                            req.valueToReceiver));

        require(sent, "Function transfer failed");

    }

    function executeTransferPermit(ForwardRequest calldata req, 
                    Permit calldata permitMessage,
                    bytes calldata signature) public{
        require(_senderWhitelist[msg.sender], "Sender is not whitelisted");

        require(IERC20(req.token).balanceOf(req.from) >= req.valueFromSender, "Check balance. ERC20: transfer amount exceeds balance");

        require(verify(req, signature), "Signature does not match");

        sendPermit(permitMessage, req.token);

        (bool success, bytes memory returndata) = 
                            req.token.call{value: 0}
                            (abi.encodeWithSelector(
                            _transferFrom, 
                            req.from, 
                            req.to, 
                            req.valueFromSender));

        require(success, "Function transferFrom failed");

        (bool sent, bytes memory data) = 
                            req.token.call{value: 0}
                            (abi.encodeWithSelector(
                            _transfer, 
                            req.receiver, 
                            req.valueToReceiver));

        require(sent, "Function transfer failed");

    }

    function executeNativeTransfer(ForwardRequest calldata req, 
                    bytes calldata signature) public payable{
        require(_senderWhitelist[msg.sender], "AwlForwarder: sender of meta-transaction is not whitelisted");

        require(IERC20(req.token).balanceOf(req.from) >= req.valueFromSender, "Check balance. ERC20: transfer amount exceeds balance");

        require(verify(req, signature), "AwlForwarder: signature does not match request");

        (bool success, bytes memory returndata) = 
                            req.token.call{value: 0}
                            (abi.encodeWithSelector(
                            _transferFrom, 
                            req.from, 
                            req.to, 
                            req.valueFromSender));

        require(success, "Function transferFrom failed");
        (bool sent, bytes memory data) = req.receiver.call{value: req.valueToReceiver}("");
        require(sent, "Transfer Native token failed");
    }

    function executeNativeTransferPermit(ForwardRequest calldata req, 
                    Permit calldata permitMessage,
                    bytes calldata signature) public payable{
        require(_senderWhitelist[msg.sender], "AwlForwarder: sender of meta-transaction is not whitelisted");

        require(IERC20(req.token).balanceOf(req.from) >= req.valueFromSender, "Check balance. ERC20: transfer amount exceeds balance");

        require(verify(req, signature), "AwlForwarder: signature does not match request");

        sendPermit(permitMessage, req.token);

        (bool success, bytes memory returndata) = 
                            req.token.call{value: 0}
                            (abi.encodeWithSelector(
                            _transferFrom, 
                            req.from, 
                            req.to, 
                            req.valueFromSender));

        require(success, "Function transferFrom failed");
        (bool sent, bytes memory data) = req.receiver.call{value: req.valueToReceiver}("");
        require(sent, "Transfer Native token failed");
    }

    function sendPermit(Permit calldata _permit, address token) internal {
        IERC20Permit(token).permit(_permit.owner, _permit.spender, _permit.value, _permit.deadline, _permit.v, _permit.r, _permit.s);
    }

    function addSenderToWhitelist(address sender) public onlyOwner() {
        require(!isWhitelisted(sender), "Sender address is already whitelisted"); 
        _senderWhitelist[sender] = true;
    }

    function removeSenderFromWhitelist(address sender) public onlyOwner() {
        _senderWhitelist[sender] = false;
    }

    function isWhitelisted(address sender) public view returns (bool) {
        return _senderWhitelist[sender];
    }

    function getFunds(address token, address receiver) public onlyOwner() {
        uint256 balance = IERC20(token).balanceOf(address(this));

        (bool success, bytes memory returndata) = 
                            token.call{value: 0}
                            (abi.encodeWithSelector(
                            _transfer, 
                            receiver, 
                            balance));
    }

}
