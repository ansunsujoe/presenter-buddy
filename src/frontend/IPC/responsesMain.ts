import { get } from "svelte/store"
import { ToMain, ToMainSendPayloads } from "../../types/IPC/ToMain"
import type { Project } from "../../types/Projects"
import type { Show } from "../../types/Show"
import { triggerAction } from "../components/actions/api"
import { receivedMidi } from "../components/actions/midi"
import { menuClick } from "../components/context/menuClick"
import { clone } from "../components/helpers/array"
import { addDrawerFolder } from "../components/helpers/dropActions"
import { history } from "../components/helpers/history"
import { captureCanvas, setMediaTracks } from "../components/helpers/media"
import { getActiveOutputs } from "../components/helpers/output"
import { loadShows, saveTextCache } from "../components/helpers/setShow"
import { checkName } from "../components/helpers/show"
import { defaultThemes } from "../components/settings/tabs/defaultThemes"
import { importBibles } from "../converters/bible"
import { convertCalendar } from "../converters/calendar"
import { convertChordPro } from "../converters/chordpro"
import { convertEasyslides } from "../converters/easyslides"
import { convertEasyWorship } from "../converters/easyworship"
import { createImageShow } from "../converters/imageShow"
import { createCategory, importShow, importSpecific, setTempShows } from "../converters/importHelpers"
import { convertLessonsPresentation } from "../converters/lessonsChurch"
import { convertOpenLP } from "../converters/openlp"
import { convertOpenSong } from "../converters/opensong"
import { convertPowerpoint } from "../converters/powerpoint"
import { addToProject, importProject } from "../converters/project"
import { convertProPresenter } from "../converters/propresenter"
import { convertQuelea } from "../converters/quelea"
import { convertSoftProjector } from "../converters/softprojector"
import { convertSongbeamerFiles } from "../converters/songbeamer"
import { convertTexts } from "../converters/txt"
import { convertVerseVIEW } from "../converters/verseview"
import { convertVideopsalm } from "../converters/videopsalm"
import {
    activeEdit,
    activePage,
    activePopup,
    activeProject,
    activeShow,
    alertMessage,
    currentOutputSettings,
    dataPath,
    dictionary,
    driveKeys,
    events,
    folders,
    lessonsLoaded,
    media,
    outputs,
    overlays,
    pcoConnected,
    popupData,
    presentationData,
    projects,
    projectTemplates,
    projectView,
    redoHistory,
    shows,
    showsCache,
    showsPath,
    stageShows,
    templates,
    textCache,
    theme,
    themes,
    undoHistory,
    usageLog,
    windowState,
} from "../stores"
import { newToast } from "../utils/common"
import { validateKeys } from "../utils/drive"
import { initializeClosing, saveComplete } from "../utils/save"
import { updateSettings, updateSyncedSettings, updateThemeValues } from "../utils/updateSettings"
import { Main, MainReturnPayloads } from "./../../types/IPC/Main"

type MainHandler<ID extends Main | ToMain> = (data: ID extends keyof ToMainSendPayloads ? ToMainSendPayloads[ID] : ID extends keyof MainReturnPayloads ? Awaited<MainReturnPayloads[ID]> : undefined) => void
export type MainResponses = {
    [ID in Main | ToMain]?: MainHandler<ID>
}

export const mainResponses: MainResponses = {
    // STORES
    [ToMain.SAVE2]: (a) => saveComplete(a),
    [Main.SETTINGS]: (a) => updateSettings(a),
    [Main.SYNCED_SETTINGS]: (a) => updateSyncedSettings(a),
    [Main.SHOWS]: async (a) => {
        let difference = Object.keys(a).length - Object.keys(get(shows)).length
        if (difference < 15 && Object.keys(get(shows)).length && difference > 0) {
            // get new shows & cache their content
            let newShowIds = Object.keys(a).filter((id) => !get(shows)[id])
            await loadShows(newShowIds)
            newShowIds.forEach((id) => saveTextCache(id, get(showsCache)[id]))
        }

        shows.set(a)
    },
    [Main.STAGE_SHOWS]: (a) => stageShows.set(a),
    [Main.PROJECTS]: (a) => {
        projects.set(a.projects || {})
        folders.set(a.folders || {})
        projectTemplates.set(a.projectTemplates || {})
    },
    [Main.OVERLAYS]: (a) => overlays.set(a),
    [Main.TEMPLATES]: (a) => templates.set(a),
    [Main.EVENTS]: (a) => events.set(a),
    [Main.MEDIA]: (a) => media.set(a),
    [Main.THEMES]: (a) => {
        themes.set(Object.keys(a).length ? a : clone(defaultThemes))

        // update if themes are loaded after settings
        if (get(theme) !== "default") updateThemeValues(get(themes)[get(theme)])
    },
    [Main.DRIVE_API_KEY]: (a) => driveKeys.set(a),
    [Main.HISTORY]: (a) => {
        undoHistory.set(a.undo || [])
        redoHistory.set(a.redo || [])
    },
    [Main.CACHE]: (a) => {
        textCache.set(a.text || {})
    },
    [Main.USAGE]: (a) => usageLog.set(a),

    // MAIN
    [ToMain.MENU]: (a) => menuClick(a),
    [Main.SHOWS_PATH]: (a) => showsPath.set(a),
    [Main.DATA_PATH]: (a) => dataPath.set(a),
    [ToMain.ALERT]: (a) => {
        alertMessage.set(a || "")

        if (a === "error.display") {
            let outputIds = getActiveOutputs(get(outputs), false, true)
            currentOutputSettings.set(outputIds[0])
            popupData.set({ activateOutput: true })
            activePopup.set("choose_screen")
            return
        }

        activePopup.set("alert")
    },
    [ToMain.TOAST]: (a) => newToast(a),
    [Main.CLOSE]: () => initializeClosing(),
    [Main.RECEIVE_MIDI]: (a) => receivedMidi(a),
    [Main.DELETE_SHOWS]: (a) => {
        if (!a.deleted.length) {
            newToast("$toast.delete_shows_empty")
            return
        }

        alertMessage.set("<h3>Deleted " + a.deleted.length + " files</h3><br>● " + a.deleted.join("<br>● "))
        activePopup.set("alert")
    },
    [ToMain.REFRESH_SHOWS2]: (a) => {
        let oldCount = Object.keys(get(shows)).length
        let newCount = Object.keys(a).length

        shows.set(a)

        if (get(activePopup) || get(activePage) !== "settings") return
        alertMessage.set("<h3>Updated shows</h3><br>● Old shows: " + oldCount + "<br>● New shows: " + newCount)
        activePopup.set("alert")
    },
    [ToMain.BACKUP]: ({ finished, path }) => {
        if (!finished) return activePopup.set(null)

        console.log("Backed up to:", path)
        newToast(get(dictionary).settings?.backup_finished || "") // + ": " + path)
    },
    [ToMain.RESTORE2]: ({ finished, starting }) => {
        if (!finished) return activePopup.set(null)
        if (starting) return newToast("$settings.restore_started")

        // close opened
        activeEdit.set({ items: [] })
        activeShow.set(null)
        activePage.set("show")

        newToast("$settings.restore_finished")
    },
    [Main.LOCATE_MEDIA_FILE]: (data) => {
        if (!data) return
        let prevPath: string = ""

        showsCache.update((a) => {
            let media = a[data.ref.showId].media[data.ref.mediaId]
            if (data.ref.cloudId) {
                if (!media.cloud) a[data.ref.showId].media[data.ref.mediaId].cloud = {}
                prevPath = a[data.ref.showId].media[data.ref.mediaId].cloud![data.ref.cloudId]
                a[data.ref.showId].media[data.ref.mediaId].cloud![data.ref.cloudId] = data.path
            } else {
                prevPath = a[data.ref.showId].media[data.ref.mediaId].path || ""
                a[data.ref.showId].media[data.ref.mediaId].path = data.path
            }

            return a
        })

        // sometimes when lagging the image will be "replaced" even when it exists
        if (prevPath !== data.path) newToast("$toast.media_replaced")
    },
    [Main.MEDIA_TRACKS]: (data) => setMediaTracks(data),
    [ToMain.API_TRIGGER2]: (data) => triggerAction(data),
    [ToMain.PRESENTATION_STATE]: (data) => presentationData.set(data),
    // TOP BAR
    [Main.MAXIMIZED]: (data) => windowState.set({ ...windowState, maximized: data }),
    // MEDIA CACHE
    [ToMain.CAPTURE_CANVAS]: (data) => captureCanvas(data),
    [ToMain.LESSONS_DONE]: (data) => lessonsLoaded.set({ ...get(lessonsLoaded), [data.showId]: data.status }),
    [ToMain.IMAGES_TO_SHOW]: (data) => createImageShow(data),

    // CONNECTION
    [ToMain.PCO_CONNECT]: (data) => {
        if (!data.success) return
        pcoConnected.set(true)
        if (data.isFirstConnection) newToast("$main.finished")
    },
    [ToMain.PCO_PROJECTS]: (data) => {
        if (!data.projects) return

        // CREATE CATEGORY
        createCategory("Planning Center")

        // CREATE SHOWS
        let tempShows: { id: string; show: Show }[] = []
        data.shows.forEach((show) => {
            let id = show.id
            delete show.id
            tempShows.push({ id, show: { ...show, name: checkName(show.name, id), locked: true } })
        })
        setTempShows(tempShows)

        data.projects.forEach((pcoProject) => {
            // CREATE PROJECT FOLDER
            let folderId = pcoProject.folderId
            if (folderId && (!get(folders)[folderId] || get(folders)[folderId].deleted)) {
                history({ id: "UPDATE", newData: { replace: { parent: "/", name: pcoProject.folderName } }, oldData: { id: folderId }, location: { page: "show", id: "project_folder" } })
            }

            // CREATE PROJECT
            let project: Project = {
                name: pcoProject.name,
                created: pcoProject.created,
                used: Date.now(), // show on top in last used list
                parent: folderId || "/",
                shows: pcoProject.items || [],
            }

            let projectId = pcoProject.id
            history({ id: "UPDATE", newData: { data: project }, oldData: { id: projectId }, location: { page: "show", id: "project" } })
        })

        // open closest to today
        activeProject.set(data.projects.sort((a, b) => a.scheduledTo - b.scheduledTo)[0]?.id)
        projectView.set(false)
    },
    [ToMain.OPEN_FOLDER2]: (a) => {
        const receiveFOLDER = {
            MEDIA: () => addDrawerFolder(a, "media"),
            AUDIO: () => addDrawerFolder(a, "audio"),
            SHOWS: () => showsPath.set(a.path),
            DATA: () => dataPath.set(a.path),
            DATA_SHOWS: () => {
                dataPath.set(a.path)
                if (a.showsPath) showsPath.set(a.showsPath)
            },
        }

        if (!receiveFOLDER[a.channel]) return
        receiveFOLDER[a.channel]()
    },
    [ToMain.OPEN_FILE2]: (a) => {
        const receiveFILE = {
            GOOGLE_KEYS: () => {
                let path = a.files[0]
                let file = a.content[path]
                if (file) validateKeys(file)
            },
        }

        if (!receiveFILE[a.channel]) return
        receiveFILE[a.channel]()
    },
    [ToMain.IMPORT2]: (a) => {
        const mainData = a.data

        const receiveFilePathIMPORT = {
            // Media
            pdf: () => addToProject("pdf", mainData as string[]),
            powerkey: () => addToProject("ppt", mainData as string[]),
        }
        if (mainData.find((a) => typeof a === "string")) {
            if (!receiveFilePathIMPORT[a.channel]) return
            receiveFilePathIMPORT[a.channel]()
            return
        }

        const data = mainData as { content: string; name?: string; extension?: string }[]

        const receiveIMPORT = {
            // FreeShow
            freeshow: () => importShow(data),
            freeshow_project: () => importProject(data),
            freeshow_template: () => importSpecific(data, templates),
            freeshow_theme: () => importSpecific(data, themes),
            // Text
            txt: () => convertTexts(data),
            chordpro: () => convertChordPro(data),
            powerpoint: () => convertPowerpoint(data),
            word: () => convertTexts(data),
            // Other programs
            propresenter: () => convertProPresenter(data),
            easyworship: () => convertEasyWorship(data),
            videopsalm: () => convertVideopsalm(data),
            openlp: () => convertOpenLP(data),
            opensong: () => convertOpenSong(data),
            quelea: () => convertQuelea(data),
            softprojector: () => convertSoftProjector(data),
            songbeamer: () => convertSongbeamerFiles(a.custom),
            easyslides: () => convertEasyslides(data),
            verseview: () => convertVerseVIEW(data),
            // Media
            lessons: () => convertLessonsPresentation(data),
            // Other
            calendar: () => convertCalendar(data),
            // Bibles
            BIBLE: () => importBibles(data),
        }

        if (!receiveIMPORT[a.channel]) return
        receiveIMPORT[a.channel]()
    },
}
