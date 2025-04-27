<script lang="ts">
    import { ShowObj } from "../../../../classes/Show"
    import { convertText, getQuickExample } from "../../../../converters/txt"
    import { createCategory } from "../../../../converters/importHelpers"
    import { activePopup, activeProject, activeShow, categories, dictionary, drawerTabsData, formatNewShow, quickTextCache, shows, special, splitLines } from "../../../../stores"
    import { sortObject } from "../../../helpers/array"
    import { history } from "../../../helpers/history"
    import Icon from "../../../helpers/Icon.svelte"
    import { checkName } from "../../../helpers/show"
    import T from "../../../helpers/T.svelte"
    import Button from "../../../inputs/Button.svelte"
    import CombinedInput from "../../../inputs/CombinedInput.svelte"
    import TextInput from "../../../inputs/TextInput.svelte"

    const changeValue = (e: any, key: string = "text") => {
        values[key] = e.target.value || ""
    }
    let values = {
        name: "",
        setNumber: "",
        text: "",
    }

    // CATEGORY

    const cats = [
        // { id: "", name: "—" }, // unlabeled
        ...sortObject(
            Object.keys($categories).map((key: string) => ({
                id: key,
                ...$categories[key],
            })),
            "name"
        ).map((cat) => ({
            id: cat.id,
            name: cat.default ? `$:${cat.name}:$` : cat.name,
        })),
    ]

    let selectedCategory: any = cats[0]
    // get the selected category
    if ($drawerTabsData.shows?.activeSubTab && $categories[$drawerTabsData.shows.activeSubTab]) selectedCategory = cats.find((a) => a.id === $drawerTabsData.shows.activeSubTab)
    // get the category from the active show
    else if ($shows[$activeShow?.id || ""]?.category) selectedCategory = cats.find((a) => a.id === $shows[$activeShow?.id || ""]?.category)
    // set to "Songs" if it exists & nothing else if selected
    else if ($categories.song) selectedCategory = cats.find((a) => a.id === "song")
    // otherwise set to first category
    else if (cats.length > 1) selectedCategory = cats[1]

    async function loadSet(setNumber: string) {
        activePopup.set(null)
        const response = await fetch(`https://api.worshipbuddy.org/liveset/V2/${setNumber}/data`)
        const setContent = await response.json()
        setContent["set_data"].forEach((song) => {
            let lyrics = processLyrics(song.lyrics)
            values["text"] = lyrics
            console.log(lyrics)
            console.log(`${song["song_number"]}. ${song["title"]}`)
            textToShow(`${song["song_number"]}. ${song["title"]}`)
        })
    }

    function processLyrics(data: string) {
        // Step 1: Replace escaped newlines with actual newlines
        data = data.replace(/\\n/g, "\n")

        // Step 2: Clean up lines and remove lines that match the pattern `|number|`
        data = data
            .split("\n")
            .filter((line) => !/\|\d+\|/.test(line)) // Remove lines with |number|
            .map((line) => line.trim().replace(/\s+/g, " ")) // Collapse whitespace
            .join("\n")

        // Step 3: Replace `*number.* ` patterns using a custom function
        data = data.replace(/\*(\d+)\.\*\s/g, (match, p1) => replaceVerse(p1))
        data = data.replace(/\*Chorus:\*/g, "[Chorus]\n")
        data = data.replace(/\*x(\d+)\*/g, (match, p1) => replaceRepeats(p1))

        // Step 4: Clump words in the same section together.
        data = data.replace(/\n{3,}/g, "\n\n") // Convert 3+ newlines to 2
        data = data.replace(/([^\n])\n{2}(?=[^\[\n])/g, "$1\n")

        // Step 5: Split verses, choruses, etc. into smaller parts.
        const sectionBlocks = data.split(/\n(?=\[.+?\])/)
        const splitSections = sectionBlocks.flatMap((block) => {
            const lines = block.trim().split("\n")
            const rawHeader = lines[0] // e.g. [Verse 1] or [Chorus]
            const contentLines = lines.slice(1)
            const headerText = rawHeader.match(/\[(.+?)\]/)?.[1] ?? "Section"
            console.log(headerText)
            const chunks: string[] = []

            for (let i = 0; i < contentLines.length; i += 4) {
                const chunkLines = contentLines.slice(i, i + 4)
                const partLabel = contentLines.length > 4 ? String.fromCharCode(65 + i / 4) : "" // A, B, C, etc.
                const labeledHeader = `[${headerText}${headerText.match(/\d/) ? partLabel : " " + partLabel}]`
                chunks.push([labeledHeader, ...chunkLines].join("\n"))
            }
            return chunks
        })
        data = splitSections.join("\n\n")
        return data
    }

    // Example stub for replaceVerse
    function replaceVerse(number) {
        return `[Verse ${number}]\n`
    }

    function replaceRepeats(repeat) {
        return repeat.slice(1, -1)
    }

    // CREATE
    function textToShow(title: string) {
        console.log("GOT HERE")
        let text = values.text
        if (typeof text !== "string") text = ""

        let sections = text.split("\n\n").filter((a) => a.length)

        // let metaData: string = ""
        // if (sections[1] && sections[0]?.split("\n").length < 3) metaData = sections.splice(0, 1)[0]
        let category = createCategory("WorshipBuddy", "song")

        if (sections.length) {
            convertText({ name: title, category, text })
        } else {
            let show = new ShowObj(false, category)
            show.name = title
            history({ id: "UPDATE", newData: { data: show, remember: { project: $activeProject } }, location: { page: "show", id: "show" } })
        }

        values = { name: "", text: "", setNumber: "" }
        quickTextCache.set("")
        activePopup.set(null)
    }

    // SHORTCUTS

    function keydown(e: KeyboardEvent) {}
</script>

<svelte:window on:keydown={keydown} />

<div>
    <p>Enter set number</p>
    <TextInput value={values.setNumber} on:input={(e) => changeValue(e, "setNumber")} />
</div>

<div class="create" style="margin-top: 10px;">
    <CombinedInput>
        <Button on:click={() => loadSet(values.setNumber)} style="width: 100%;" dark center>
            <div class="text" style="display: flex;align-items: center;padding: 0;">
                <Icon id="showIcon" right />
                <T id="new.set" />
            </div>
        </Button>
    </CombinedInput>
</div>
