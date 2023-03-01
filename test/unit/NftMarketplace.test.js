const { expect, assert } = require("chai");
const { network, ethers, getNamedAccounts } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");


!developmentChains.includes(network.name) 
    ? describe.skip
    : describe("Nft Marketplace Tests", function(){

        let nftMarketplace, deployer, basicNft, player
        const PRICE = ethers.utils.parseEther("0.1")
        const TOKEN_ID = 0


        beforeEach(async function(){
            deployer = (await getNamedAccounts()).deployer
            // player = (await getNamedAccounts()).player

            const accounts = await ethers.getSigners()
            player = accounts[1]
            await deployments.fixture(["all"])
            nftMarketplace = await ethers.getContract("NftMarketplace")
            basicNft = await ethers.getContract("BasicNft")
            await basicNft.mintNft()
            await basicNft.approve(nftMarketplace.address, TOKEN_ID)

        })

        describe("listItem", function(){

            it("lists and can be bought", async function() {
                await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)

                //connect player to the nftmarketplace and let him buy the nft

                const playerConnectedNftMarketplace = nftMarketplace.connect(player)
                await playerConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {value: PRICE})
                const newOwner = await basicNft.ownerOf(TOKEN_ID)
                const deployerProceeds = await nftMarketplace.getProceeds(deployer)

                assert(newOwner.toString() == player.address)
                assert(deployerProceeds.toString() == PRICE.toString())
            })

            it("emits an event after listing an item", async function(){
                expect(await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)).to.emit("ItemListed")
            })

            it("reverts if the item is already listed", async function(){
                await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)

                //now trying to list the same item again
                await expect(nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)).to.be.revertedWith("NftMarketplace__AlreadyListed")
            })

            it("exclusively allows owners to list", async function () {
                // await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                // const owner = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
                // const theSeller = owner.seller
                // expect(theSeller == deployer)

                const playerConnectedNftMarketplace = nftMarketplace.connect(player)
                await basicNft.approve(playerConnectedNftMarketplace.address, TOKEN_ID)
                
                await expect(
                    playerConnectedNftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                ).to.be.revertedWith("NftMarketplace__NotOwner")
            }) 

            it("needs approvals to list item", async  function(){
                await basicNft.approve(ethers.constants.AddressZero, TOKEN_ID)

                await expect(nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)).to.be.revertedWith("NftMarketplace__NotApprovedForMarketplace")
            })


            it("Updates listing with seller and price", async function () {
                await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                
                const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
                assert(listing.price.toString() == PRICE.toString())
                assert(listing.seller == deployer)
            })
        })

        describe("cancelListing", function(){

            it("reverts if there is no listing", async function(){

                await expect(
                    nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
                ).to.be.revertedWith("NftMarketplace__NotListed")

            })

            it("reverts if anyone but the owner tries to call", async function(){
                await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)

                const playerConnectedNftMarketplace = nftMarketplace.connect(player)

                await expect(
                    playerConnectedNftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
                ).to.be.revertedWith("NftMarketplace__NotOwner")

            })

            it("emits event and removes listing", async function() {
                await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)

                expect(
                    await nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
                ).to.emit("ItemCanceled")
                
                const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
                assert(listing.price.toString() == "0")
            })
        })

        describe("buyItem", function(){

            it("reverts if the item isnt listed", async function(){
                await expect(
                    nftMarketplace.buyItem(basicNft.address, TOKEN_ID)
                ).to.be.revertedWith("NftMarketplace__NotListed")
            })

            it("reverts if price is not met", async function(){
                await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)

                await expect(
                    nftMarketplace.buyItem(basicNft.address, TOKEN_ID)  //no money is given here
                ).to.be.revertedWith("NftMarketplace__PriceNotMet")

                const newPrice = ethers.utils.parseEther("0.01")

                await expect(
                    nftMarketplace.buyItem(basicNft.address, TOKEN_ID, {value: newPrice}) //less money is given here
                ).to.be.revertedWith("NftMarketplace__PriceNotMet")
            })

            it("transfers the nft to the buyer and updates internal proceeds record", async function(){
                await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)

                const buyer = nftMarketplace.connect(player)

                expect(
                    await buyer.buyItem(basicNft.address, TOKEN_ID, { value: PRICE }) 
                ).to.emit("ItemBought")   
                
                const newOwner = await basicNft.ownerOf(TOKEN_ID)
                const deployerProceeds = await nftMarketplace.getProceeds(deployer)

                assert(newOwner.toString() == player.address)
                assert(deployerProceeds.toString() == PRICE.toString())
            })            
        })


        describe("updateListing", function() {
            
            it("reverts if not owner or not listed", async function(){

                await expect(
                    nftMarketplace.updateListing(basicNft.address, TOKEN_ID, PRICE)
                ).to.be.revertedWith("NftMarketplace__NotListed")

                await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)

                const newUser = nftMarketplace.connect(player)

                await expect(
                    newUser.updateListing(basicNft.address, TOKEN_ID, PRICE)
                ).to.be.revertedWith("NftMarketplace__NotOwner")
            })

            it("updates the price of the item", async function(){

                const updatedPrice = ethers.utils.parseEther("0.2")
                await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)

                expect( 
                    await nftMarketplace.updateListing(basicNft.address, TOKEN_ID, updatedPrice)
                ).to.emit("ItemUpdated")
            })
        })

        describe("withdrawProceeds", function(){

            it("doesn't allow 0 proceed withdrawls", async function(){
                await expect(nftMarketplace.withdrawProceeds()).to.be.revertedWith("NftMarketplace__NoProceeds")
            })

          
            // it("withdraws proceeds", async function () {

            //     await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                
            //     nftMarketplace.connect(player)
            //     await nftMarketplace.buyItem(basicNft.address, TOKEN_ID, { value: PRICE })
                
            //     nftMarketplace.connect(deployer)

            //     const deployerProceedsBefore = await nftMarketplace.getProceeds(deployer)
            //     // const deployerBalanceBefore = await deployer.getBalance()

            //     const txResponse = await nftMarketplace.withdrawProceeds()
            //     const transactionReceipt = await txResponse.wait(1)

            //     const { gasUsed, effectiveGasPrice } = transactionReceipt
            //     const gasCost = gasUsed.mul(effectiveGasPrice)
                
            //     const deployerBalanceAfter = await nftMarketplace.getProceeds(deployer)

            //     assert(
            //         deployerBalanceAfter.add(gasCost).toString() ==
            //             deployerProceedsBefore.add(PRICE).toString()
            //     )

            // })

        })

    })   