
import React, { useEffect } from 'react';
import { GameState } from './types';
import { useGameEngine } from './hooks/useGameEngine';

// Screens
import { LandingScreen } from './components/screens/LandingScreen';
import { SetupScreen } from './components/screens/SetupScreen';
import { LoadingScreen } from './components/screens/LoadingScreen';
import { GameScreen } from './components/screens/GameScreen';
import { LoadGameScreen } from './components/screens/LoadGameScreen';

// Modals
import { GalleryModal, ImageViewer, SettingsModal } from './components/modals/SystemModals';
import { ExitConfirmModal, RegenConfirmModal, HistoryModal, CharacterModal, SkillModal, ImageGenModal, RegenAvatarModal } from './components/modals/GameplayModals';

const App: React.FC = () => {
  const game = useGameEngine();

  // Update document title based on state
  useEffect(() => {
    switch (game.gameState) {
      case GameState.LANDING: document.title = "欢迎回来"; break;
      case GameState.SETUP: document.title = "命运抉择"; break;
      case GameState.LOADING: document.title = "穿越中..."; break;
      case GameState.PLAYING: document.title = "正在您的史诗中"; break;
      case GameState.LOAD_GAME: document.title = "记忆回廊"; break;
      default: document.title = "主角光环";
    }
  }, [game.gameState]);

  const shouldBlur = Object.values(game.modals).some(v => v) || !!game.viewingImage;

  // Determine which character to show in modal
  const viewingCharacter = game.selectedCharacterId 
      ? (game.context.supportingCharacters.find(c => c.id === game.selectedCharacterId) || game.context.character)
      : game.context.character;

  const isWarning = game.modals.saveExistingNotification;

  return (
    <div className="w-full h-full bg-black font-sans text-gray-100 overflow-hidden">
        {game.gameState === GameState.LANDING && (
            <LandingScreen 
                bgImage={game.bgImage}
                shouldBlur={shouldBlur}
                setGameState={game.setGameState}
                onStartNewGame={game.handleStartNewGameSetup}
                onOpenLoad={() => game.setGameState(GameState.LOAD_GAME)}
                onOpenGallery={() => game.toggleModal('gallery', true)}
                onOpenSettings={() => game.toggleModal('settings', true)}
                playClickSound={game.playClickSound}
                playHoverSound={game.playHoverSound}
            />
        )}

        {game.gameState === GameState.SETUP && (
            <SetupScreen 
                context={game.context}
                setContext={game.setContext}
                bgImage={game.bgImage}
                setGameState={game.setGameState}
                handleStartGame={game.handleStartGame}
                error={game.error}
                onSaveConfig={game.handleSaveSetup}
                tempData={game.setupTempData}
                setTempData={game.setSetupTempData}
                playClickSound={game.playClickSound}
                handleAutoPlanBlueprint={game.handleAutoPlanBlueprint}
                isGeneratingBlueprint={game.isLoading}
            />
        )}

        {game.gameState === GameState.LOADING && (
            <LoadingScreen 
                progress={game.loadingProgress} 
                bgImage={game.bgImage} 
                onAbort={game.handleAbortGame}
            />
        )}
        
        {game.gameState === GameState.LOAD_GAME && (
            <LoadGameScreen 
                savedGames={game.savedGames}
                onLoad={game.handleLoadGame}
                onDelete={game.deleteSaveGame}
                onDeleteSession={game.deleteSession}
                onImport={game.importSaveGame}
                onUndo={game.handleUndoDelete}
                canUndo={game.deletedSavesStack.length > 0}
                onBack={() => game.setGameState(GameState.LANDING)}
                playClickSound={game.playClickSound}
            />
        )}

        {game.gameState === GameState.PLAYING && (
            <GameScreen 
                context={game.context}
                setContext={game.setContext}
                bgImage={game.bgImage}
                backgroundStyle={game.backgroundStyle}
                battleAnim={game.battleAnim}
                generatingImage={game.generatingImage}
                isLoading={game.isLoading}
                isUiVisible={game.isUiVisible}
                setIsUiVisible={game.setIsUiVisible}
                isMuted={game.isMuted}
                setIsMuted={game.setIsMuted}
                volume={game.volume}
                setVolume={game.setVolume}
                textTypingComplete={game.textTypingComplete}
                setTextTypingComplete={game.setTextTypingComplete}
                typingSpeed={game.typingSpeed}
                setTypingSpeed={game.setTypingSpeed}
                inputMode={game.inputMode}
                
                handleBackToHome={game.handleBackToHome}
                handleManualSave={game.handleManualSave}
                handleChoice={game.handleChoice}
                handleUseSkill={(skill) => { game.toggleModal('skill', false); game.handleChoice(`(发动技能) ${skill.name}: ${skill.description}`); }}
                handleSummarizeMemory={game.handleSummarizeMemory}
                handleRegenerate={game.handleRegenerate}
                handleSwitchVersion={game.handleSwitchVersion}
                handleGlobalReplace={game.handleGlobalReplace} 
                handleAddScheduledEvent={game.handleAddScheduledEvent} 
                handleUpdateScheduledEvent={game.handleUpdateScheduledEvent} 
                handleDeleteScheduledEvent={game.handleDeleteScheduledEvent} 
                isSummarizing={game.isSummarizing}
                
                onOpenImageModal={() => game.toggleModal('image', true)}
                onOpenCharacterModal={(charId) => { 
                    game.setSelectedCharacterId(charId || null); 
                    game.toggleModal('character', true); 
                }}
                onOpenHistoryModal={() => game.toggleModal('history', true)}
                onOpenSkillModal={() => game.toggleModal('skill', true)}
                onOpenRegenConfirm={() => game.toggleModal('regenConfirm', true)}
                onOpenSettings={() => game.toggleModal('settings', true)}
                
                shouldBlurBackground={shouldBlur}
                playClickSound={game.playClickSound}
                
                visualEffect={game.visualEffect}
                setVisualEffect={game.setVisualEffect}
                autoSaveState={game.autoSaveState}
                showStoryPanelBackground={game.showStoryPanelBackground}
                storyFontSize={game.storyFontSize}
                storyFontFamily={game.storyFontFamily}
                
                isCurrentBgFavorited={game.isCurrentBgFavorited}
                onToggleFavorite={game.toggleCurrentBgFavorite}
            />
        )}

        {/* Notification - Save Status (Manual & Auto) */}
        {(game.modals.saveNotification || game.modals.saveExistingNotification || game.autoSaveState === 'complete') && (
            <div className={`fixed top-6 left-6 z-[100] px-6 py-3 rounded-lg backdrop-blur-xl animate-fade-in-right shadow-lg border flex items-center gap-3 font-bold tracking-wider pointer-events-none ${isWarning ? 'bg-amber-900/90 text-amber-100 border-amber-500/30 shadow-amber-500/20' : 'bg-green-900/90 text-green-100 shadow-green-500/30 border-green-500/30'}`}>
                {isWarning ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-amber-400">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-green-400">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                )}
                <div className="flex flex-col">
                    <span className="text-sm">
                        {game.modals.saveExistingNotification
                            ? "当前剧情节点已存在"
                            : game.modals.saveNotification
                                ? "进度已手动保存"
                                : "系统自动存档"}
                    </span>
                </div>
            </div>
        )}

        {/* --- Modals --- */}

        {game.modals.gallery && (
            <GalleryModal 
                gallery={game.gallery} 
                onClose={() => game.toggleModal('gallery', false)} 
                onViewImage={(item) => game.setViewingImage(item)} 
                onDelete={game.deleteFromGallery} 
            />
        )}

        {game.viewingImage && (
            <ImageViewer image={game.viewingImage} onClose={() => game.setViewingImage(null)} />
        )}

        {game.modals.settings && (
            <SettingsModal 
                onClose={() => game.toggleModal('settings', false)}
                aiModel={game.aiModel}
                setAiModel={game.handleSetAiModel}
                imageModel={game.imageModel}
                setImageModel={game.handleSetImageModel}
                avatarStyle={game.avatarStyle}
                setAvatarStyle={game.handleSetAvatarStyle}
                customAvatarStyle={game.customAvatarStyle}
                setCustomAvatarStyle={game.handleSetCustomAvatarStyle}
                avatarRefImage={game.avatarRefImage}
                setAvatarRefImage={game.handleSetAvatarRefImage}
                backgroundStyle={game.backgroundStyle}
                setBackgroundStyle={game.handleSetBackgroundStyle}
                inputMode={game.inputMode}
                setInputMode={game.handleSetInputMode}
                modelScopeApiKey={game.modelScopeApiKey}
                setModelScopeApiKey={game.handleSetModelScopeApiKey}
                onTestModelScope={game.handleTestModelScope}
                
                isMuted={game.isMuted}
                setIsMuted={game.setIsMuted}
                volume={game.volume}
                setVolume={game.setVolume}
                
                customPrompt={game.customPrompt}
                setCustomPrompt={game.handleSetCustomPrompt}
                showStoryPanelBackground={game.showStoryPanelBackground}
                setShowStoryPanelBackground={game.handleSetShowStoryPanelBackground}
                
                historyFontSize={game.historyFontSize}
                setHistoryFontSize={game.handleSetHistoryFontSize}
                storyFontSize={game.storyFontSize}
                setStoryFontSize={game.handleSetStoryFontSize}
                storyFontFamily={game.storyFontFamily}
                setStoryFontFamily={game.handleSetStoryFontFamily}
                
                autoSaveGallery={game.autoSaveGallery}
                setAutoSaveGallery={game.handleSetAutoSaveGallery}
            />
        )}

        {game.modals.exitConfirm && (
            <ExitConfirmModal onConfirm={() => { game.setGameState(GameState.LANDING); game.toggleModal('exitConfirm', false); }} onCancel={() => game.toggleModal('exitConfirm', false)} />
        )}

        {game.modals.regenConfirm && (
            <RegenConfirmModal onConfirm={() => { game.handleGenerateImage(); game.toggleModal('regenConfirm', false); }} onCancel={() => game.toggleModal('regenConfirm', false)} />
        )}

        {game.modals.history && (
            <HistoryModal 
                history={game.context.history} 
                onClose={() => game.toggleModal('history', false)} 
                fontSize={game.historyFontSize}
                fontFamily={game.storyFontFamily}
                plotBlueprint={game.context.plotBlueprint}
                storyName={game.context.storyName}
            />
        )}

        {game.modals.character && (
            <CharacterModal 
                context={game.context} 
                character={viewingCharacter as any}
                onClose={() => game.toggleModal('character', false)}
                onOpenRegenAvatar={() => game.toggleModal('avatarGen', true)}
                isGenerating={game.generatingImage}
            />
        )}
        
        {game.modals.avatarGen && (
            <RegenAvatarModal
                onGenerate={() => { game.handleRegenerateAvatar(); game.toggleModal('avatarGen', false); }}
                onClose={() => game.toggleModal('avatarGen', false)}
                selectedStyle={game.selectedImageStyle}
                onSelectStyle={game.setSelectedImageStyle}
                customStyle={game.customImageStyle}
                onCustomStyleChange={game.setCustomImageStyle}
            />
        )}

        {game.modals.skill && (
            <SkillModal 
                skills={game.context.character.skills} 
                onUseSkill={(skill) => { game.toggleModal('skill', false); game.handleChoice(`(发动技能) ${skill.name}: ${skill.description}`); }} 
                onClose={() => game.toggleModal('skill', false)}
                onUpgrade={(skill) => game.handleUpgradeSkill(skill.id)}
            />
        )}

        {game.modals.image && (
            <ImageGenModal 
                selectedStyle={game.selectedImageStyle}
                onSelectStyle={game.setSelectedImageStyle}
                onGenerate={() => { game.handleGenerateImage(); game.toggleModal('image', false); }}
                onClose={() => game.toggleModal('image', false)}
                customStyle={game.customImageStyle}
                onCustomStyleChange={game.setCustomImageStyle}
            />
        )}
    </div>
  );
};

export default App;
