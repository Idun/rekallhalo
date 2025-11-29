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
import { ExitConfirmModal, RegenConfirmModal, HistoryModal, CharacterModal, SkillModal, ImageGenModal } from './components/modals/GameplayModals';

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
                onBack={() => game.setGameState(GameState.LANDING)}
                playClickSound={game.playClickSound}
            />
        )}

        {game.gameState === GameState.PLAYING && (
            <GameScreen 
                context={game.context}
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

        {/* Notification - Manual Save */}
        {game.modals.saveNotification && (
            <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-green-900/80 text-green-100 px-6 py-3 rounded-full backdrop-blur-xl animate-fade-in-up shadow-[0_0_20px_rgba(34,197,94,0.3)] border border-green-500/30 flex items-center gap-3 font-bold tracking-wider">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-green-400"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                <span>进度已保存</span>
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
            />
        )}

        {game.modals.character && (
            <CharacterModal 
                context={game.context} 
                character={viewingCharacter as any}
                onClose={() => game.toggleModal('character', false)} 
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
                onGenerate={game.handleGenerateImage}
                onClose={() => game.toggleModal('image', false)}
                customStyle={game.customImageStyle}
                onCustomStyleChange={game.setCustomImageStyle}
            />
        )}
    </div>
  );
};

export default App;
