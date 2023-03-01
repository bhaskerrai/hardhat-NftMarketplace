// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

error NftMarketplace__PriceMustBeAboveZero();
error NftMarketplace__NotApprovedForMarketplace();
error NftMarketplace__AlreadyListed(address nftAddress, uint256 tokenId);
error NftMarketplace__NotOwner();
error NftMarketplace__NotListed(address nftAddress, uint256 tokenId);
error NftMarketplace__PriceNotMet(address nftAddress, uint256 tokenId, uint256 price);
error NftMarketplace__NoProceeds();
error NftMarketplace__TransferFailed();


contract NftMarketplace is ReentrancyGuard{


    struct Listing {
        uint256 price;
        address seller; 
    }


    //events
    event ItemListed(
        address indexed seller,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price
    );

    event ItemBought(
        address indexed buyer, 
        address indexed nftAddress,  
        uint256 indexed tokenId,
        uint256 price
    );

    event ItemCanceled(
        address indexed seller, 
        address indexed nftAddress,  
        uint256 indexed tokenId    
    );
    



    //state variables:

    // NFT Contract address -—> NFT TokenID -> Listing
    mapping (address => mapping (uint256 => Listing)) private s_listings;

    // Seller address —> Amount earned
    mapping(address => uint256) private s_proceeds;


    //modifiers
    modifier notListed(address nftAddress, uint256 tokenId, address owner) {

        Listing memory listing = s_listings[nftAddress][tokenId];

        if (listing.price > 0) {
            revert NftMarketplace__AlreadyListed(nftAddress, tokenId);
        }
        _;
    }

    modifier isOwner(address nftAddress, uint256 tokenId, address spender) {

        IERC721 nft = IERC721(nftAddress);
        
        address owner = nft.ownerOf(tokenId);

        if (spender != owner) {
            revert NftMarketplace__NotOwner();
        }
        _;
    }

    modifier isListed(address nftAddress, uint256 tokenId) {

        Listing memory listing = s_listings[nftAddress][tokenId];

        if (listing.price <= 0) {
            revert NftMarketplace__NotListed(nftAddress, tokenId);
        }
        _;
    }




    /* 
    1. `listItem`: List NFTs on the marketplace ✅
    2. `buyItem`: Buy the NFTs on the marketplace ✅
    3. `cancelItem`: Cancel a listing ✅
    4. `updateListing`: Update Price ✅
    5. `withdrawProceeds`: Withdraw payment for my bought NFTs ✅
    */



    function listItem(
        address nftAddress,
        uint256 tokenId,
        uint256 price
    ) 
        external 
        notListed(nftAddress, tokenId, msg.sender) //modifier, check above
        isOwner(nftAddress, tokenId, msg.sender)   //modifier, check above
        
    {

        if (price <= 0) {
            revert NftMarketplace__PriceMustBeAboveZero();
        }

        IERC721 nft = IERC721(nftAddress);

        if (nft.getApproved(tokenId) != address(this)) {
            revert NftMarketplace__NotApprovedForMarketplace();
        }
        
        s_listings[nftAddress][tokenId] = Listing(price, msg.sender);

        emit ItemListed(msg.sender, nftAddress, tokenId, price);
    }


    function buyItem(address nftAddress, uint256 tokenId) 
        external 
        payable 
        nonReentrant
        isListed(nftAddress, tokenId)

    {
        Listing memory listedItem = s_listings[nftAddress][tokenId];

        if (msg.value < listedItem.price) {
            revert NftMarketplace__PriceNotMet(nftAddress, tokenId, listedItem.price);
        }

        // Sending the money to the user ❌
        // Have them withdraw money ✅


        s_proceeds[listedItem.seller] = s_proceeds[listedItem.seller] + msg.value;
        delete (s_listings[nftAddress][tokenId]);

        IERC721(nftAddress).safeTransferFrom(listedItem.seller, msg.sender, tokenId);

        emit ItemBought(msg.sender, nftAddress, tokenId, listedItem.price);

    }


    function cancelListing(address nftAddress, uint256 tokenId) 
        external
        isOwner(nftAddress, tokenId, msg.sender)
        isListed(nftAddress, tokenId)
    {
        delete(s_listings[nftAddress][tokenId]);
        emit ItemCanceled(msg.sender, nftAddress, tokenId);

    }

     
    function updateListing(address nftAddress, uint256 tokenId, uint newPrice) 
        external
        isOwner(nftAddress, tokenId, msg.sender)
        isListed(nftAddress, tokenId)
    {
        s_listings[nftAddress][tokenId].price = newPrice;

        emit ItemListed(msg.sender, nftAddress, tokenId, newPrice);

    }

    function withdrawProceeds() external {

        uint256 proceeds = s_proceeds[msg.sender];

        if (proceeds <= 0) {
            revert NftMarketplace__NoProceeds();
        }

        s_proceeds[msg.sender] = 0; //always reset to zero before transfering or withdrawing. this prevents reetrancy attacks.

        (bool success, ) = payable(msg.sender).call{value: proceeds}("");

        if (!success) {
            revert NftMarketplace__TransferFailed();
        }
    }



    //getter functions:

    function getListing(address nftAddress, uint256 tokenId) external view returns(Listing memory) {
        return s_listings[nftAddress][tokenId];
    }

     function getProceeds(address seller) external view returns(uint256) {
        return s_proceeds[seller];
    }

        
}