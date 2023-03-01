const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name) 
    ? describe.skip 
    : describe("Basic Unit NFT test", function() {

        let basicNft, deployer
        
        beforeEach(async function() {
            const accounts = await ethers.getSigners()
            deployer = accounts[0]
            await deployments.fixture(["basicnft"])
            basicNft = await ethers.getContract("BasicNft")

        })

        describe("Constructor", function(){
            it("Initializes the NFT correctly", async function() {
                const name = await basicNft.name()
                const symbol = await basicNft.symbol()
                const tokenCounter = await basicNft.getTokenCounter()

                assert.equal(name, "Dogie")
                assert.equal(symbol, "DOG")
                assert.equal(tokenCounter.toString(), "0")
                
            })
        })

        describe("Mint NFT", function(){

            beforeEach(async function(){
                const txRespone = await basicNft.mintNft()
                await txRespone.wait(1)
            })
        
            it("Allows users to mint NFTs, and updates appropriately", async function(){
        
                const tokenCounter = await basicNft.getTokenCounter()
                const tokenUrl = await basicNft.tokenURI(0)
    
                assert.equal(tokenCounter.toString(), "1")
                assert.equal(tokenUrl, await basicNft.TOKEN_URI())             
            })

            it("Shows the correct balance and owner of an NFT", async function(){
                deployerAddress = deployer.address
                deployerBalance = await basicNft.balanceOf(deployerAddress)
                owner = await basicNft.ownerOf(0)

                assert.equal(deployerBalance.toString(), "1")
                assert.equal(owner, deployerAddress)
            })

        })
        
        
    })