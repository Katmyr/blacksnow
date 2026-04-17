document.addEventListener("DOMContentLoaded", function () {
    const members = [
        {
            name: "MARIE",
            role: "Présidente / Danseuse / Chanteuse",
            //gardienne: "Gardienne du Courage, Incarnation de l'Orgueil",
            defaultImg: "images/marie.png",
            hoverImg: "images/marie.png",
            defaultIcon: "https://static.vecteezy.com/system/resources/previews/036/631/694/non_2x/sun-free-vector.png",
            hoverIcon: "https://static.vecteezy.com/system/resources/previews/036/666/670/non_2x/moon-free-vector.png",
            quote: "Le silence est parfois plus éloquent que mille mots.",
            song : "Tomboy - (G)I-DLE",
            socialLinks: {
                instagram: "https://www.instagram.com/_punkyskull_/",
            }
        },
        {
            name: "SOO",
            role: "Vice-Présidente / Danseuse",
            //gardienne: "Gardienne du Jeu, Incarnation du Vide",
            defaultImg: "images/soo.png",
            hoverImg: "images/soo.png",
            defaultIcon: "https://static.vecteezy.com/system/resources/previews/036/631/694/non_2x/sun-free-vector.png",
            hoverIcon: "https://static.vecteezy.com/system/resources/previews/036/666/670/non_2x/moon-free-vector.png",
            quote: "Les chiffres sont une poésie silencieuse.",
            song : "With You - B.A.P",
            socialLinks: {
                instagram: "https://www.instagram.com/so_solveig_12/",
            }
        },
        {
            name: "JULIE",
            role: "Trésorière / Danseuse / Chanteuse",
            //gardienne: "Gardienne de l'Admiration, Incarnation de la Jalousie",
            defaultImg: "images/julie.png",
            hoverImg: "images/julie.png",
            defaultIcon: "https://static.vecteezy.com/system/resources/previews/036/631/694/non_2x/sun-free-vector.png",
            hoverIcon: "https://static.vecteezy.com/system/resources/previews/036/666/670/non_2x/moon-free-vector.png",
            quote: "Les chiffres sont une poésie silencieuse.",
            song : "No - CLC",
            socialLinks: {
                instagram: "https://www.instagram.com/juliemarouset?igsh=NGJjdnB3bDZvYWkw",
                tiktok: "https://www.tiktok.com/@ju_dansetok?_t=ZN-8vYqCJ8b8Ss&_r=1",
            }
        },
        {
            name: "CARMEN",
            role: "Danseuse / Chanteuse",
            //gardienne: "Gardienne de la Charité, Incarnation de l'Avarice",
            defaultImg: "images/carmen.png",
            hoverImg: "images/carmen.png",
            defaultIcon: "https://static.vecteezy.com/system/resources/previews/036/631/694/non_2x/sun-free-vector.png",
            hoverIcon: "https://static.vecteezy.com/system/resources/previews/036/666/670/non_2x/moon-free-vector.png",
            quote: "Les chiffres sont une poésie silencieuse.",
            song : "Senorita - i-dle",
            socialLinks: {
                tiktok: "https://www.tiktok.com/@mystie666?_t=ZN-8vWZE5LtqDe&_r=1",
            }
        },
        {
            name: "SOUMEYA",
            role: "Danseuse / Chanteuse",
            //gardienne: "Gardienne de la Curiosité, Incarnation de l'Ennui",
            defaultImg: "images/soumeya.png",
            hoverImg: "images/soumeya.png",
            defaultIcon: "https://static.vecteezy.com/system/resources/previews/036/631/694/non_2x/sun-free-vector.png",
            hoverIcon: "https://static.vecteezy.com/system/resources/previews/036/666/670/non_2x/moon-free-vector.png",
            quote: "I swear we about to move a mountain, keep your eyes on that track.",
            song : "Circus - Stray Kids",
            socialLinks: {
        
            }
        },
        {
            name: "GEMMA",
            role: "Danseuse / Chanteuse",
            //gardienne: "Gardienne de la Joie, Incarnation de la Tristesse",
            defaultImg: "images/gemma.png",
            hoverImg: "images/gemma.png",
            defaultIcon: "https://static.vecteezy.com/system/resources/previews/036/631/694/non_2x/sun-free-vector.png",
            hoverIcon: "https://static.vecteezy.com/system/resources/previews/036/666/670/non_2x/moon-free-vector.png",
            quote: "Brew a cup of life and death’s, joy and grief, to honour a young man.",
            song : "Laffy Taffy - Esther Yu",
            socialLinks: {
                instagram: "https://www.instagram.com/wanjing_tiaowu_/",
                youtube: "https://www.youtube.com/@GL02Music",
                xiaohongshu:{
                    url:"https://www.xiaohongshu.com/user/profile/627bd6930000000021023cca",
                    icon:"https://api.iconify.design/simple-icons/xiaohongshu.svg?color=white",
                },
                bilibili : "https://m.bilibili.com/space/3546571582999182?fbclid=PAY2xjawJomVhleHRuA2FlbQIxMAABp6Sgw-mwYeV-NFXcc9aJCtX2vFzwHxZ8q1j3nO2lRwe9uFRfWeAOz_Fga51J_aem_lS1x1rbQ3w-XcNhY_a7Fyw",
            }
        },
        {
            name: "LAURINE",
            role: "Secrétaire / Danseuse",
            //gardienne: "Gardienne de l'Energie, Incarnation de l'Impatience",
            defaultImg: "images/laurine.png",
            hoverImg: "images/laurine.png",
            defaultIcon: "https://static.vecteezy.com/system/resources/previews/036/631/694/non_2x/sun-free-vector.png",
            hoverIcon: "https://static.vecteezy.com/system/resources/previews/036/666/670/non_2x/moon-free-vector.png",
            quote: "Comme une étincelle dans l’obscurité, je trace ma route avec ma propre lumière.",
            song : "Stress - ChungHa",
            socialLinks: {
                instagram: "https://www.instagram.com/laurine.u?igsh=MWJjbmF4Nms5dTI1OQ==",
                tiktok: "https://www.tiktok.com/@laurine.lfb?_t=ZN-8vV2ijzC9H4&_r=1",
            }
        },
        {
            name: "ALICE",
            role: "Danseuse",
            //gardienne: "Gardienne de l'Amour, Incarnation de la Haine",
            defaultImg: "images/alice.png",
            hoverImg: "images/alice.png",
            defaultIcon: "https://static.vecteezy.com/system/resources/previews/036/631/694/non_2x/sun-free-vector.png",
            hoverIcon: "https://static.vecteezy.com/system/resources/previews/036/666/670/non_2x/moon-free-vector.png",
            quote: "Les chiffres sont une poésie silencieuse.",
            song : "Wild Flower - RM",
            socialLinks: {
                
            }
        },
        {
            name: "HELENE",
            role: "Danseuse / Chanteuse",
            //gardienne: "Gardienne de la Curiosité, Incarnation de l'Ennui",
            defaultImg: "images/helene.png",
            hoverImg: "images/helene.png",
            defaultIcon: "https://static.vecteezy.com/system/resources/previews/036/631/694/non_2x/sun-free-vector.png",
            hoverIcon: "https://static.vecteezy.com/system/resources/previews/036/666/670/non_2x/moon-free-vector.png",
            quote: "I swear we about to move a mountain, keep your eyes on that track.",
            song : "New Woman - LISA, ROSALÍA",
            socialLinks: {
                instagram: "https://www.instagram.com/wearegingerpearl/",
            }
        },
    ];

    const container = document.getElementById("members-container");


    // Function to create and render member cards dynamically
    members.forEach(function(member) {
        const card = document.createElement("div");
        card.classList.add("rounded-lg", "overflow-hidden", "border-2", "transition", "duration-300", "y2k-card");

        // Dynamically build social media links
        let socialMediaHTML = '';
        Object.entries(member.socialLinks).forEach(([platform, data]) => {
            if (typeof data === "string") {
                socialMediaHTML += `
                    <a href="${data}" target="_blank" class="w-10 h-10 rounded-full border-2 flex items-center justify-center transition duration-300">
                        <i class="fab fa-${platform}"></i>
                    </a>
                `;
            } else if (typeof data === "object" && data.url && data.icon) {
                socialMediaHTML += `
                    <a href="${data.url}" target="_blank" class="w-10 h-10 rounded-full border-2 flex items-center justify-center transition duration-300">
                        <img src="${data.icon}" alt="${platform}" class="w-5 h-5">
                    </a>
                `;
            }
        });
        
        
        card.innerHTML = `
            <div class="relative overflow-hidden h-80">
                <img id="img-${member.name}" src="${member.defaultImg}" alt="${member.name}" class="w-full h-full object-cover transition-all duration-300">


                <div class="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80"></div>
                <div class="absolute bottom-0 left-0 p-6">
                    <h3 class="text-3xl font-bold">${member.name}</h3>
                    <p class="text-neon-blue">${member.role}</p>
                </div>
            </div>
            <div class="p-6">

                <p class="text-gray-300 mb-4">♪ ${member.song}</p>
                <div class="flex space-x-4">
                    ${socialMediaHTML}
                </div>
                </div>


        `;

        // Add event listeners to switch images and icons on hover
        card.addEventListener("mouseenter", function () {
            document.getElementById(`img-${member.name}`).src = member.hoverImg;
            document.querySelector(`#icon-${member.name} img`).src = member.hoverIcon;
        });

        card.addEventListener("mouseleave", function () {
            document.getElementById(`img-${member.name}`).src = member.defaultImg;
            document.querySelector(`#icon-${member.name} img`).src = member.defaultIcon;
        });

        // Append the card to the container
        container.appendChild(card);
    });
});
