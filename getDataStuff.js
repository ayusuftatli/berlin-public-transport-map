async function getSomeData() {
    const bbox = 'north=52.52411&west=13.41002&south=52.51942&east=13.41709'
    const url = `https://v6.vbb.transport.rest/radar?${bbox}&results=100`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            const errorData = await response.text();
            console.error(`[getData] API Error (${response.status}):`, errorData);
            throw new Error(`Response status ${response.status}: ${errorData}`);
        }

        const result = await response.json();

        result.movements.forEach(movement => {
            console.log("Product: ", movement.line.product)
        })


    }
    catch (error) {
        console.log(error)
    }

}

getSomeData()