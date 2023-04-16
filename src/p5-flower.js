import p5 from 'p5';

export function FlowerCanvas() {
    // Create p5 instance
    const sketch = (p) => {
        let x;
        let y;

        let petals = [];
        let petalCount;
        let petalOutlineColor;
        let petalOutlineWidth;

        let stemLength;
        let stemWidth;
        let stemHeight;
        let stemColor;
        let isStemDrawn;

        let flowerCenterX;
        let flowerCenterY;
        let flowerAnimationMaxX;
        let flowerAnimationStartingMaxX;
        let flowerAnimationSpeed;
        let flowerAnimationDeviation;

        let isStartSequenceFinished;
        let windAngle = 0;
        let maxRadius = 70;

        p.setup = () => {
            p.createCanvas(600, 700);
            x = p.width / 2;
            y = p.height / 2;
            isStartSequenceFinished = false;
            
            stemWidth = 6;
            stemHeight = p.height;
            stemLength = 0;
            stemColor = p.color(p.random(255), p.random(255), p.random(255));
            isStemDrawn = false;
            
            petalCount = 0;
            petalOutlineColor = stemColor;
            petalOutlineWidth = 4;
            
            flowerCenterX = 0;
            flowerCenterY = 0;
            flowerAnimationMaxX = 35;
            flowerAnimationStartingMaxX = 35;
            flowerAnimationSpeed = 0.5;
            flowerAnimationDeviation = 20;

            CreatePetals()
        };

        p.draw = () => {
            p.background("#EDD8C6");

            if (!isStartSequenceFinished)
                StartSequence();
            else {
                AnimateFlowerCenter();

                // Draw stem
                p.strokeWeight(stemWidth);
                p.stroke(stemColor);
                let ctrlX = x - (flowerCenterX * 0.5);
                let ctrlY = y * 1.50;
                p.noFill();
                p.bezier(x, p.height, ctrlX, ctrlY, ctrlX, ctrlY, x + flowerCenterX, y + flowerCenterY);

                // Petals
                DrawPetal(petals.length);
            }
        };

        function StartSequence() {
            // Animate stem on start
            if (!isStemDrawn) {
                if (stemHeight > y) {
                    stemHeight -= 12;
                } else {
                    isStemDrawn = true;
                    stemHeight = y;
                }
            }

            // Draw stem
            p.strokeWeight(stemWidth);
            p.stroke(stemColor);
            p.line(x, p.height, x, stemHeight);

            // Animate petals on start
            if (isStemDrawn) {
                DrawPetal(petalCount);
                petalCount++;

                if (petalCount == petals.length)
                    isStartSequenceFinished = true;
            }
        }

        function AnimateFlowerCenter() {
            let windMagnitude = 2;
            let windDirectionX = p.cos(windAngle);
            let windDirectionY = p.sin(windAngle);
            let windForceX = windMagnitude * windDirectionX;
            let windForceY = windMagnitude * windDirectionY;

            let distanceFromCenter = p.dist(flowerCenterX, flowerCenterY, 0, 0);
            
            flowerCenterX += windForceX * p.max(( 1 - (distanceFromCenter / maxRadius)), 0.15);
            flowerCenterY += windForceY * p.max(( 1 - (distanceFromCenter / maxRadius)), 0.15) * 0.5;

            if (distanceFromCenter > maxRadius) {
                let angleToCenter = p.atan2(-flowerCenterY, -flowerCenterX);
                windAngle = angleToCenter += p.random(-0.3, 0.3);
            }

            windAngle += p.random(-0.05, 0.05);
        }


        function DrawPetal(count) {
            // Outline for petals
            p.stroke(petalOutlineColor);
            p.strokeWeight(petalOutlineWidth);

            for (let i = 0; i < count; i++) {
                let petal = petals[i];

                p.push();
                p.translate(petal[0] + flowerCenterX, petal[1] + flowerCenterY);
                p.rotate(petal[2] - p.HALF_PI);
                p.fill(petal[3]);
                p.ellipse(0, 0, petal[4], petal[5]);
                p.pop();
            }
        }

        function CreatePetals() {
            // Make petals
            let layerCount = p.int(p.random(3, 5));
            for (let j = layerCount; j > 0; j--) {

                let petalLength = p.random(10, 20)
                let petalXSize = p.random(10, 20);
                let petalYSize = p.random(10, 20);

                if (j != 1) {
                    petalLength = p.random(20 + (10 * j - 2), 60 + (10 * j - 2));
                    petalXSize = p.random(30, 50) * j;
                    petalYSize = p.random(20, 40) * j;
                }

                let petalCount = p.int(p.random(5, 12));
                let petalColor = p.color(p.random(255), p.random(255), p.random(255));


                if (petalXSize > petalYSize) {
                    let temp = petalYSize;
                    petalYSize = petalXSize;
                    petalXSize = temp;
                }

                p.noStroke();
                for (let i = 0; i < petalCount; i++) {
                    let angle = i * p.TWO_PI / petalCount;
                    let petalX = x + petalLength * p.cos(angle);
                    let petalY = y + petalLength * p.sin(angle);
                    let angleToCenter = p.atan2(y - petalY, x - petalX);
                    petals.push([petalX, petalY, angleToCenter, petalColor, petalXSize, petalYSize, j]);
                }
            }
        }
    }

    new p5(sketch, document.getElementById("flowerCanvas"));
}

