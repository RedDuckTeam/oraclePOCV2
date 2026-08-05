//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.10;

import {RLPReader} from "./utils/RLPReader.sol";
import {ECDSA} from "./utils/ECDSA.sol";
import {Ownable} from "./utils/Ownable.sol";
import {IPermissionOracle} from "./utils/IPermissionOracle.sol";

contract SignatureVerify is Ownable, IPermissionOracle {
    using RLPReader for RLPReader.RLPItem;
    using RLPReader for bytes;
    using ECDSA for bytes32;

    mapping(address => bool) public blacklistedContracts;
    mapping(address => bool) public blacklistedUsers;

    event ContractBlacklisted(address indexed contractAddress);
    event ContractUnblacklisted(address indexed contractAddress);
    event UserBlacklisted(
        address indexed user,
        address indexed contractAddress
    );
    event UserUnblacklisted(address indexed user);

    error ForeignChainId(uint256 expected, uint256 actual);
    error MissingChainId();
    error AlreadyBlacklisted(address target);
    error NotBlacklisted(address target);

    /// @notice Blacklists the signer of `message` if it was sent to a
    /// blacklisted contract. Permissionless: the signer is recovered from the
    /// transaction itself, so a caller can only report what someone actually
    /// signed.
    /// @param message The raw (unsigned) serialized transaction.
    /// @param signature The signature over `keccak256(message)`.
    /// @return to The `to` address decoded from `message`.
    function report(
        bytes calldata message,
        bytes calldata signature
    ) external returns (address to) {
        uint256 chainId;
        (to, chainId) = _rlpToToAndChainId(message);

        // Without this, a transaction signed for another chain could be
        // replayed here to blacklist its signer.
        if (chainId != block.chainid) {
            revert ForeignChainId(block.chainid, chainId);
        }

        if (blacklistedContracts[to]) {
            address from = keccak256(message).recover(signature);
            if (!blacklistedUsers[from]) {
                blacklistedUsers[from] = true;
                emit UserBlacklisted(from, to);
            }
        }
    }

    function addBlacklistedContract(
        address contractAddress
    ) external onlyOwner {
        if (blacklistedContracts[contractAddress]) {
            revert AlreadyBlacklisted(contractAddress);
        }
        blacklistedContracts[contractAddress] = true;
        emit ContractBlacklisted(contractAddress);
    }

    function removeBlacklistedContract(
        address contractAddress
    ) external onlyOwner {
        if (!blacklistedContracts[contractAddress]) {
            revert NotBlacklisted(contractAddress);
        }
        blacklistedContracts[contractAddress] = false;
        emit ContractUnblacklisted(contractAddress);
    }

    /// @notice Lifts a ban. Reporting is automatic and permissionless, so the
    /// owner needs a way to undo a ban that should not have happened.
    function unblacklistUser(address user) external onlyOwner {
        if (!blacklistedUsers[user]) revert NotBlacklisted(user);
        blacklistedUsers[user] = false;
        emit UserUnblacklisted(user);
    }

    /// @inheritdoc IPermissionOracle
    /// @dev A ban is global: `_where`, `_permissionId` and `_data` are
    /// deliberately ignored, a blacklisted address is denied everything.
    function isGranted(
        address,
        address _who,
        bytes32,
        bytes calldata
    ) external view override returns (bool allowed) {
        allowed = !blacklistedUsers[_who];
    }

    /// @dev Field layout per transaction type:
    /// legacy (EIP-155): [nonce, gasPrice, gasLimit, to, value, data, chainId, 0, 0]
    /// 0x01 (EIP-2930):  [chainId, nonce, gasPrice, gasLimit, to, ...]
    /// 0x02 (EIP-1559):  [chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, ...]
    function _rlpToToAndChainId(
        bytes calldata message
    ) private pure returns (address to, uint256 chainId) {
        bytes1 txType = message[0];

        bytes memory rlpBytes;
        if (txType == 0x01 || txType == 0x02) {
            rlpBytes = message[1:];
        } else {
            rlpBytes = message;
        }

        RLPReader.RLPItem[] memory ls = rlpBytes.toRlpItem().toList();

        if (txType == 0x01) {
            return (ls[4].toAddress(), ls[0].toUint());
        }
        if (txType == 0x02) {
            return (ls[5].toAddress(), ls[0].toUint());
        }

        // Pre-EIP-155 legacy transactions carry no chain id and are replayable
        // across chains by construction, so they cannot be reported safely.
        if (ls.length < 7) revert MissingChainId();
        return (ls[3].toAddress(), ls[6].toUint());
    }
}
