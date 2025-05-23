<script lang="ts">
    import { onMount } from "svelte"
    import type { Tree } from "../../../types/Projects"
    import { activePopup, dictionary, folders, labelsDisabled, openedFolders, projects } from "../../stores"
    import { history } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"
    import ProjectButton from "../inputs/ProjectButton.svelte"
    import ProjectFolder from "../inputs/ProjectFolder.svelte"
    import Loader from "../main/Loader.svelte"
    import Center from "../system/Center.svelte"
    import SelectElem from "../system/SelectElem.svelte"

    export let tree: Tree[]

    function checkIfShown(project: any) {
        let allOpened = true
        project.path!.split("/").forEach((id: string) => {
            if (id.length && !$openedFolders.includes(id)) allOpened = false
        })
        return allOpened
    }

    let startLoading: boolean = tree.length < 50
    onMount(() => {
        // remove any deleted opened folders (and remove duplicates)
        openedFolders.set([...new Set($openedFolders.filter((id) => $folders[id]))])

        setTimeout(() => (startLoading = true), 20)
    })

    let foldersWithoutContent: string[] = []
    $: if (tree && $openedFolders) checkFolders()
    function checkFolders() {
        foldersWithoutContent = []
        // only check opened folders
        $openedFolders.forEach((folderId) => {
            if (Object.values($projects).find((a) => a.parent === folderId)) return
            if (Object.values($folders).find((a) => a.parent === folderId)) return

            foldersWithoutContent.push(folderId)
        })
    }
</script>

{#if tree.length}
    {#if startLoading}
        {#each tree as project}
            {@const opened = $openedFolders.includes(project.id || "")}
            {@const shown = checkIfShown(project)}
            {@const isEmpty = project.type === "folder" && foldersWithoutContent.includes(project.id || "")}

            <div class:indented={project.parent !== "/"} style="margin-left: {8 * (project.index || 0)}px;background-color: rgb(255 255 255 / {0.01 * (project.index || 0)});">
                <!-- , path: project.path -->
                <SelectElem id={project.type || "project"} data={{ type: project.type || "project", id: project.id }} draggable trigger="column" borders="center">
                    {#if project.type === "folder" && (project.parent === "/" || shown)}
                        <ProjectFolder {project} {opened} />
                    {:else if project.id && shown}
                        <ProjectButton name={project.name} parent={project.parent} id={project.id} />
                    {/if}
                </SelectElem>
            </div>

            {#if shown && isEmpty}
                <!-- padding: 5px 0; -->
                <div class:indented={project.parent !== "/"} style="margin-left: {8 * ((project.index || 0) + 1)}px;display: flex;align-items: center;flex-direction: column;">
                    <p style="opacity: 0.5;padding-bottom: 5px;"><T id="empty.general" /></p>
                    <Button style="width: 100%;" on:click={() => history({ id: "UPDATE", newData: { replace: { parent: project.id } }, location: { page: "show", id: "project" } })} title={$dictionary.new?.project} center dark>
                        <Icon id="add" right={!$labelsDisabled} />
                        {#if !$labelsDisabled}<p><T id="new.project" /></p>{/if}
                    </Button>
                </div>
            {/if}
        {/each}
    {:else}
        <Center>
            <Loader />
        </Center>
    {/if}
{:else}
    <Center faded>
        <T id="empty.general" />
    </Center>
{/if}

<style>
    .indented {
        border-left: 2px solid var(--primary-lighter);
    }
</style>
